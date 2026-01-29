import { Outlet } from "react-router";
import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import AdminNavigation from '~/components/admin/AdminNavigation';

const theme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#1976d2',
        },
        secondary: {
            main: '#dc004e',
        },
    },
    typography: {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    },
});

export default function AdminLayout() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box sx={{ display: 'flex', minHeight: '100vh' }}>
                <AdminNavigation />
                <Box
                    component="main"
                    sx={{
                        flexGrow: 1,
                        p: 3,
                        width: { sm: `calc(100% - 280px)` },
                    }}
                >
                    <Outlet />
                </Box>
            </Box>
        </ThemeProvider>
    );
}
