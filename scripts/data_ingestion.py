#!/usr/bin/env python3
"""
Data Ingestion Script for Satellite Ground Station Location Optimization
Processes mobile carrier CSV files, NBN shapefiles, and KML data into PostGIS database.
"""

import os
import sys
import pandas as pd
import geopandas as gpd
import psycopg2
from psycopg2.extras import RealDictCursor
from sqlalchemy import create_engine, text
import logging
from datetime import datetime
from pathlib import Path
import fiona
from shapely.geometry import Point
import xml.etree.ElementTree as ET
from tqdm import tqdm

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('data_import.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class DatabaseConnection:
    """Manage PostgreSQL database connections with PostGIS support"""
    
    def __init__(self):
        self.db_config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': int(os.getenv('DB_PORT', 5432)),
            'database': os.getenv('DB_NAME', 'sgs'),
            'user': os.getenv('DB_USER', 'postgres'),
            'password': os.getenv('DB_PASSWORD', 'newpassword')
        }
        
        # Create SQLAlchemy engine for pandas/geopandas
        self.engine = create_engine(
            f"postgresql://{self.db_config['user']}:{self.db_config['password']}@"
            f"{self.db_config['host']}:{self.db_config['port']}/{self.db_config['database']}"
        )
        
    def get_connection(self):
        """Get raw psycopg2 connection"""
        return psycopg2.connect(**self.db_config)
    
    def test_connection(self):
        """Test database connection and PostGIS availability"""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT PostGIS_Version();")
                    version = cursor.fetchone()[0]
                    logger.info(f"Connected to PostGIS: {version}")
                    return True
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            return False

class MobileSiteIngestion:
    """Handle mobile carrier CSV data ingestion"""
    
    def __init__(self, db_conn):
        self.db = db_conn
        
    def parse_frequency_bands(self, row, carrier):
        """Extract frequency bands from CSV columns based on carrier"""
        bands = []
        
        if carrier.lower() == 'optus':
            band_columns = ['NBIoT700', 'UMTS900', 'UMTS2100', 'LTE700', 'LTE900', 
                          'LTE1800', 'LTE2100', 'LTE2300', 'LTE2600', 'NR900', 
                          'NR2100', 'NR2300', 'NR3500', 'NR26000']
        elif carrier.lower() == 'telstra':
            band_columns = ['GSM900', 'IoT700', 'WCDMA850', 'WCDMA2100', 'LTE700', 
                          'LTE850', 'LTE900', 'LTE1800', 'LTE2100', 'LTE2600', 
                          'NR700', 'NR850', 'NR2100', 'NR2600', 'NR3600', 'NR26000']
        elif carrier.lower() == 'tpg':
            band_columns = ['NBIoT850', 'LTE700', 'LTE850', 'LTE1800', 'LTE2100', 
                          'NR700', 'NR1800', 'NR2100', 'NR3600', 'NR26000']
        else:
            return bands
            
        for band in band_columns:
            if band in row and str(row[band]).upper() == 'Y':
                bands.append(band)
                
        return bands
    
    def determine_technology(self, bands):
        """Determine primary technology based on frequency bands"""
        if any('NR' in band for band in bands):
            return '5G'
        elif any('LTE' in band for band in bands):
            return '4G/LTE'
        elif any('UMTS' in band or 'WCDMA' in band for band in bands):
            return '3G'
        elif any('GSM' in band for band in bands):
            return '2G'
        else:
            return 'Unknown'
    
    def process_csv_file(self, file_path, carrier_name):
        """Process a single mobile carrier CSV file"""
        logger.info(f"Processing {carrier_name} data from {file_path}")
        
        try:
            # Read CSV file
            df = pd.read_csv(file_path)
            logger.info(f"Loaded {len(df)} records from {file_path}")
            
            # Prepare data for database insertion
            processed_records = []
            
            for idx, row in tqdm(df.iterrows(), total=len(df), desc=f"Processing {carrier_name}"):
                try:
                    # Extract frequency bands
                    freq_bands = self.parse_frequency_bands(row, carrier_name)
                    technology = self.determine_technology(freq_bands)
                    
                    # Validate coordinates (Australia bounds)
                    lat = float(row['Latitude'])
                    lon = float(row['Longitude'])
                    
                    # Skip records with invalid coordinates
                    if not (-50 <= lat <= -10 and 110 <= lon <= 160):
                        logger.warning(f"Skipping {carrier_name} site {row['RFNSA ID']} with invalid coordinates: {lat}, {lon}")
                        continue
                    
                    # Create record
                    record = {
                        'site_id': str(row['RFNSA ID']),
                        'carrier': carrier_name,
                        'site_name': f"{carrier_name} Site {row['RFNSA ID']}",
                        'latitude': lat,
                        'longitude': lon,
                        'frequency_bands': freq_bands,
                        'technology': technology,
                        'operational_status': 'Active',
                        'data_source': f"CSV_{carrier_name}_{datetime.now().year}",
                        'last_updated': datetime.now()
                    }
                    
                    # Add co-funding information if available
                    if 'Co_funded' in row and str(row['Co_funded']).upper() == 'Y':
                        record['site_type'] = 'Co-funded'
                        if 'Co_contribution_program' in row:
                            record['site_name'] += f" ({row['Co_contribution_program']})"
                    
                    processed_records.append(record)
                    
                except Exception as e:
                    logger.warning(f"Error processing row {idx} for {carrier_name}: {e}")
                    continue
            
            return processed_records
            
        except Exception as e:
            logger.error(f"Error processing {file_path}: {e}")
            return []
    
    def insert_mobile_sites(self, records):
        """Insert mobile site records into database"""
        if not records:
            logger.warning("No records to insert")
            return 0
            
        logger.info(f"Inserting {len(records)} mobile site records")
        
        try:
            with self.db.get_connection() as conn:
                with conn.cursor() as cursor:
                    # Prepare SQL with PostGIS geometry creation
                    insert_sql = """
                    INSERT INTO mobile_sites (
                        site_id, carrier, site_name, latitude, longitude, location, location_mga56,
                        frequency_bands, technology, operational_status, data_source, last_updated,
                        site_type
                    ) VALUES (
                        %(site_id)s, %(carrier)s, %(site_name)s, %(latitude)s, %(longitude)s,
                        ST_SetSRID(ST_MakePoint(%(longitude)s, %(latitude)s), 4326),
                        ST_Transform(ST_SetSRID(ST_MakePoint(%(longitude)s, %(latitude)s), 4326), 7856),
                        %(frequency_bands)s, %(technology)s, %(operational_status)s, 
                        %(data_source)s, %(last_updated)s, %(site_type)s
                    ) ON CONFLICT (site_id, carrier) 
                    DO UPDATE SET
                        site_name = EXCLUDED.site_name,
                        latitude = EXCLUDED.latitude,
                        longitude = EXCLUDED.longitude,
                        location = EXCLUDED.location,
                        location_mga56 = EXCLUDED.location_mga56,
                        frequency_bands = EXCLUDED.frequency_bands,
                        technology = EXCLUDED.technology,
                        operational_status = EXCLUDED.operational_status,
                        last_updated = EXCLUDED.last_updated,
                        site_type = COALESCE(EXCLUDED.site_type, mobile_sites.site_type)
                    """
                    
                    inserted_count = 0
                    for record in tqdm(records, desc="Inserting records"):
                        # Set default site_type if not specified
                        if 'site_type' not in record:
                            record['site_type'] = 'Standard'
                            
                        cursor.execute(insert_sql, record)
                        inserted_count += 1
                    
                    conn.commit()
                    logger.info(f"Successfully inserted/updated {inserted_count} mobile site records")
                    return inserted_count
                    
        except Exception as e:
            logger.error(f"Error inserting mobile sites: {e}")
            return 0

class NBNDataIngestion:
    """Handle NBN shapefile data ingestion"""
    
    def __init__(self, db_conn):
        self.db = db_conn
        
    def process_nbn_shapefile(self, shapefile_path, coverage_type):
        """Process NBN shapefile data"""
        logger.info(f"Processing NBN {coverage_type} data from {shapefile_path}")
        
        try:
            # Read shapefile with geopandas
            gdf = gpd.read_file(shapefile_path)
            logger.info(f"Loaded {len(gdf)} NBN {coverage_type} polygons")
            
            # Ensure CRS is set (assuming GDA2020 / MGA Zone 56)
            if gdf.crs is None:
                logger.warning("No CRS found, assuming EPSG:7856 (GDA2020 MGA56)")
                gdf.set_crs(epsg=7856, inplace=True)
            
            # Transform to WGS84 for storage
            gdf = gdf.to_crs(epsg=4326)
            
            # Add metadata columns
            gdf['coverage_type'] = coverage_type
            gdf['data_source'] = f"NBN_Shapefile_{datetime.now().year}"
            gdf['last_updated'] = datetime.now()
            
            # Determine table name
            table_name = f"nbn_{coverage_type.lower().replace(' ', '_')}_coverage"
            
            # Insert into database using geopandas
            gdf.to_postgis(
                table_name,
                self.db.engine,
                if_exists='replace',  # Replace existing data
                index=False
            )
            
            logger.info(f"Successfully inserted {len(gdf)} {coverage_type} coverage areas")
            return len(gdf)
            
        except Exception as e:
            logger.error(f"Error processing NBN {coverage_type} shapefile: {e}")
            return 0

class KMLDataIngestion:
    """Handle KML coverage data ingestion"""
    
    def __init__(self, db_conn):
        self.db = db_conn
        
    def process_optus_kml(self, kml_path):
        """Process Optus KML coverage data"""
        logger.info(f"Processing Optus KML data from {kml_path}")
        
        try:
            # Read KML with fiona/geopandas
            gdf = gpd.read_file(kml_path, driver='KML')
            logger.info(f"Loaded {len(gdf)} coverage areas from KML")
            
            # Ensure WGS84 CRS
            if gdf.crs != 'EPSG:4326':
                gdf = gdf.to_crs(epsg=4326)
            
            # Rename and map KML columns to database schema
            gdf = gdf.rename(columns={'Name': 'name', 'Description': 'description'})
            
            # Add metadata columns to match mobile_coverage_areas schema
            gdf['carrier'] = 'Optus'
            gdf['technology'] = '4G'
            gdf['coverage_type'] = '4G External Antenna'
            gdf['signal_strength'] = 'Good'  # Default value
            gdf['data_source'] = f"Optus_KML_{datetime.now().year}"
            gdf['last_updated'] = datetime.now()
            
            # Rename geometry column and add MGA56 projection
            gdf = gdf.rename(columns={'geometry': 'geometry'})
            gdf['geometry_mga56'] = gdf.geometry.to_crs('EPSG:7856')
            
            # Calculate area in square kilometers
            gdf_mga56 = gdf.copy()
            gdf_mga56 = gdf_mga56.set_geometry('geometry_mga56')
            gdf['area_sqkm'] = gdf_mga56.geometry.area / 1_000_000  # Convert to km²
            
            # Remove columns that don't exist in database and reorder
            columns_to_keep = ['carrier', 'technology', 'coverage_type', 'signal_strength', 
                             'geometry', 'area_sqkm', 'last_updated', 'data_source']
            gdf = gdf[columns_to_keep]
            
            # Insert into mobile_coverage_areas table
            gdf.to_postgis(
                'mobile_coverage_areas',
                self.db.engine,
                if_exists='append',
                index=False
            )
            
            logger.info(f"Successfully inserted {len(gdf)} Optus coverage areas")
            return len(gdf)
            
        except Exception as e:
            logger.error(f"Error processing Optus KML: {e}")
            return 0

def main():
    """Main data ingestion workflow"""
    logger.info("Starting SGS Data Ingestion Process")
    
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv('/Users/minesh/Agents/sgs/backend/.env')
    
    # Initialize database connection
    db = DatabaseConnection()
    if not db.test_connection():
        logger.error("Database connection failed. Exiting.")
        return 1
    
    # Initialize ingestion classes
    mobile_ingestion = MobileSiteIngestion(db)
    nbn_ingestion = NBNDataIngestion(db)
    kml_ingestion = KMLDataIngestion(db)
    
    # Define data file paths
    base_path = Path('/Users/minesh/Agents/sgs')
    
    # Process mobile carrier CSV files
    mobile_files = [
        (base_path / 'mobile-sites-optus-2024.csv', 'Optus'),
        (base_path / 'mobile-sites-telstra-2024 (1).csv', 'Telstra'),
        (base_path / 'mobile-sites-tpg-2024.csv', 'TPG')
    ]
    
    total_mobile_records = 0
    for file_path, carrier in mobile_files:
        if file_path.exists():
            records = mobile_ingestion.process_csv_file(file_path, carrier)
            inserted = mobile_ingestion.insert_mobile_sites(records)
            total_mobile_records += inserted
        else:
            logger.warning(f"Mobile sites file not found: {file_path}")
    
    # Process NBN shapefiles
    nbn_files = [
        (base_path / 'nbn_coverage_fixedline.shp', 'Fixed Line'),
        (base_path / 'nbn_coverage_wireless.shp', 'Wireless')
    ]
    
    total_nbn_records = 0
    for file_path, coverage_type in nbn_files:
        if file_path.exists():
            inserted = nbn_ingestion.process_nbn_shapefile(file_path, coverage_type)
            total_nbn_records += inserted
        else:
            logger.warning(f"NBN shapefile not found: {file_path}")
    
    # Process Optus KML
    kml_file = base_path / 'Coverage map - Optus - 4G - Ext Ant - 2024.kml'
    total_kml_records = 0
    if kml_file.exists():
        total_kml_records = kml_ingestion.process_optus_kml(kml_file)
    else:
        logger.warning(f"Optus KML file not found: {kml_file}")
    
    # Summary
    logger.info("=== Data Ingestion Summary ===")
    logger.info(f"Mobile sites processed: {total_mobile_records}")
    logger.info(f"NBN coverage areas processed: {total_nbn_records}")
    logger.info(f"Optus KML coverage areas processed: {total_kml_records}")
    logger.info("Data ingestion completed successfully!")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
