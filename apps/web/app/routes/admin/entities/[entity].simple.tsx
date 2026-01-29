import React from 'react';
import { useParams } from 'react-router';
import { Box, Typography } from '@mui/material';

export default function SimpleEntityPage() {
    const { entity } = useParams<{ entity: string }>();

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                Entity: {entity}
            </Typography>
            <Typography>
                This is a simple test page for the {entity} entity.
                If you can see this, navigation is working!
            </Typography>
            <Typography sx={{ mt: 2 }}>
                Current URL: /admin/entities/{entity}
            </Typography>
        </Box>
    );
}
