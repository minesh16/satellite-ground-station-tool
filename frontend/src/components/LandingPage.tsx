import React from 'react';
import {
  Box,
  Button,
  Fade,
  Typography,
} from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';

interface LandingPageProps {
  onEnterApp: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onEnterApp }) => {

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `url('/background_image.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Spacer to push content down */}
      <Box sx={{ flex: 1 }} />
      
      {/* Bottom Content - Button positioned between logo and tagline */}
      <Box sx={{ textAlign: 'center', pb: 6 }}>
        {/* Enter Platform Button */}
        <Fade in timeout={1000}>
          <Button
            variant="contained"
            size="large"
            endIcon={<ArrowForwardIcon />}
            onClick={onEnterApp}
            sx={{
              px: 6,
              py: 3,
              fontSize: '1.2rem',
              fontWeight: 600,
              borderRadius: 50,
              textTransform: 'none',
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(10px)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.3s ease-in-out',
              mb: 6,
              position: 'relative',
              zIndex: 1,
              '&:hover': {
                background: 'rgba(255, 255, 255, 0.25)',
                transform: 'translateY(-2px)',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.3)',
                border: '2px solid rgba(255, 255, 255, 0.5)',
              },
              '&:active': {
                transform: 'translateY(0px)',
              }
            }}
          >
            Enter Platform
          </Button>
        </Fade>

        {/* Bottom Tagline */}
        <Fade in timeout={1500}>
          <Box>
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: '2rem', sm: '2.8rem', md: '3.5rem', lg: '4rem' },
                fontWeight: 300,
                color: 'rgba(255, 255, 255, 0.8)',
                textShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
                letterSpacing: '2px',
                lineHeight: 1.2,
                textTransform: 'uppercase',
              }}
            >
              Advanced Location Intelligence
            </Typography>
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: '2rem', sm: '2.8rem', md: '3.5rem', lg: '4rem' },
                fontWeight: 300,
                color: 'rgba(255, 255, 255, 0.8)',
                textShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
                letterSpacing: '2px',
                lineHeight: 1.2,
                textTransform: 'uppercase',
                mt: 1,
              }}
            >
              & Analysis Platform
            </Typography>
          </Box>
        </Fade>
      </Box>
    </Box>
  );
};

export default LandingPage;
