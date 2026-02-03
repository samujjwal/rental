import { useState } from 'react';
import { Button, Card, CardContent, Typography, Box, Grid } from '@mui/material';
import {
    FadeIn,
    SlideIn,
    ScaleOnHover,
    StaggerList,
    ModalAnimation,
    BackdropAnimation,
    Bounce,
    Shake,
    Pulse,
    Wiggle,
    FloatOnHover,
    PressableScale,
} from '~/components/animations';

/**
 * Animations Demo Page
 * Showcases all animation components
 */
export default function AnimationsDemo() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [shakeError, setShakeError] = useState(false);
    const [wiggleTrigger, setWiggleTrigger] = useState(false);

    const demoItems = [
        { id: 1, title: 'Item 1', description: 'First staggered item' },
        { id: 2, title: 'Item 2', description: 'Second staggered item' },
        { id: 3, title: 'Item 3', description: 'Third staggered item' },
        { id: 4, title: 'Item 4', description: 'Fourth staggered item' },
    ];

    const triggerShake = () => {
        setShakeError(true);
        setTimeout(() => setShakeError(false), 500);
    };

    const triggerWiggle = () => {
        setWiggleTrigger(true);
        setTimeout(() => setWiggleTrigger(false), 500);
    };

    return (
        <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
            <Typography variant="h3" component="h1" gutterBottom>
                Animation Components Demo
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
                Interactive showcase of all animation components with framer-motion
            </Typography>

            {/* FadeIn Examples */}
            <Box sx={{ mb: 6 }}>
                <Typography variant="h5" gutterBottom>
                    FadeIn Animations
                </Typography>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                        <FadeIn direction="none">
                            <Card>
                                <CardContent>
                                    <Typography variant="h6">Simple Fade</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Fades in without direction
                                    </Typography>
                                </CardContent>
                            </Card>
                        </FadeIn>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <FadeIn direction="up" delay={0.2}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6">Fade Up</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Fades in from bottom
                                    </Typography>
                                </CardContent>
                            </Card>
                        </FadeIn>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <FadeIn direction="left" delay={0.4}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6">Fade Left</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Fades in from right
                                    </Typography>
                                </CardContent>
                            </Card>
                        </FadeIn>
                    </Grid>
                </Grid>
            </Box>

            {/* SlideIn Examples */}
            <Box sx={{ mb: 6 }}>
                <Typography variant="h5" gutterBottom>
                    SlideIn Animations
                </Typography>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <SlideIn direction="up">
                            <Card>
                                <CardContent>
                                    <Typography variant="h6">Slide Up</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Slides in from bottom with larger distance
                                    </Typography>
                                </CardContent>
                            </Card>
                        </SlideIn>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <SlideIn direction="right" delay={0.2}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6">Slide Right</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Slides in from left side
                                    </Typography>
                                </CardContent>
                            </Card>
                        </SlideIn>
                    </Grid>
                </Grid>
            </Box>

            {/* Hover Animations */}
            <Box sx={{ mb: 6 }}>
                <Typography variant="h5" gutterBottom>
                    Hover Animations
                </Typography>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                        <ScaleOnHover>
                            <Card sx={{ cursor: 'pointer' }}>
                                <CardContent>
                                    <Typography variant="h6">Scale on Hover</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Hover to see scale effect
                                    </Typography>
                                </CardContent>
                            </Card>
                        </ScaleOnHover>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <FloatOnHover>
                            <Card sx={{ cursor: 'pointer' }}>
                                <CardContent>
                                    <Typography variant="h6">Float on Hover</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Hover to see float effect
                                    </Typography>
                                </CardContent>
                            </Card>
                        </FloatOnHover>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <PressableScale>
                            <Card sx={{ cursor: 'pointer' }}>
                                <CardContent>
                                    <Typography variant="h6">Press to Scale</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Click to see press effect
                                    </Typography>
                                </CardContent>
                            </Card>
                        </PressableScale>
                    </Grid>
                </Grid>
            </Box>

            {/* Stagger Animation */}
            <Box sx={{ mb: 6 }}>
                <Typography variant="h5" gutterBottom>
                    Stagger Animation
                </Typography>
                <StaggerList
                    items={demoItems}
                    renderItem={(item) => (
                        <Card sx={{ mb: 2 }}>
                            <CardContent>
                                <Typography variant="h6">{item.title}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {item.description}
                                </Typography>
                            </CardContent>
                        </Card>
                    )}
                    staggerDelay={0.15}
                />
            </Box>

            {/* Micro-interactions */}
            <Box sx={{ mb: 6 }}>
                <Typography variant="h5" gutterBottom>
                    Micro-interactions
                </Typography>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={3}>
                        <Bounce>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6">Bounce</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Bounces on mount
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Bounce>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Shake trigger={shakeError}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6">Shake</Typography>
                                    <Button onClick={triggerShake} size="small" variant="outlined">
                                        Trigger Shake
                                    </Button>
                                </CardContent>
                            </Card>
                        </Shake>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Pulse repeat>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6">Pulse</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Pulses continuously
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Pulse>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Wiggle trigger={wiggleTrigger}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6">Wiggle</Typography>
                                    <Button onClick={triggerWiggle} size="small" variant="outlined">
                                        Trigger Wiggle
                                    </Button>
                                </CardContent>
                            </Card>
                        </Wiggle>
                    </Grid>
                </Grid>
            </Box>

            {/* Modal Animation */}
            <Box sx={{ mb: 6 }}>
                <Typography variant="h5" gutterBottom>
                    Modal Animation
                </Typography>
                <Button variant="contained" onClick={() => setIsModalOpen(true)}>
                    Open Animated Modal
                </Button>

                <BackdropAnimation isOpen={isModalOpen} onClick={() => setIsModalOpen(false)} />
                <ModalAnimation isOpen={isModalOpen} variant="scale">
                    <Box
                        sx={{
                            position: 'fixed',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 50,
                            width: '90%',
                            maxWidth: 500,
                        }}
                    >
                        <Card>
                            <CardContent>
                                <Typography variant="h5" gutterBottom>
                                    Animated Modal
                                </Typography>
                                <Typography variant="body1" paragraph>
                                    This modal uses framer-motion for smooth entrance and exit animations.
                                </Typography>
                                <Button variant="contained" onClick={() => setIsModalOpen(false)}>
                                    Close Modal
                                </Button>
                            </CardContent>
                        </Card>
                    </Box>
                </ModalAnimation>
            </Box>

            {/* Usage Notes */}
            <Box sx={{ mb: 6 }}>
                <Card sx={{ bgcolor: 'info.light', color: 'info.contrastText' }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Accessibility Note
                        </Typography>
                        <Typography variant="body2">
                            All animations respect the user's <code>prefers-reduced-motion</code> setting.
                            Users who prefer reduced motion will see instant transitions instead of animations.
                        </Typography>
                    </CardContent>
                </Card>
            </Box>
        </Box>
    );
}
