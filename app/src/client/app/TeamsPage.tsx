import { Link } from 'react-router-dom';
import { Button, Grid, Container, Typography, Box, Card, Stack, TextField } from '@mui/material';

import type { User } from 'wasp/entities';

export default function TeamsPage({ user }: { user: User }) {
  return (
    <Container maxWidth='md'>
      <Box sx={{ paddingTop: 4 }}>
        <Stack spacing={4} direction='column'>
          <div>
            <Grid container spacing={2} justifyContent='space-between' alignItems='flex-start'>
              <Grid item>
                <Typography variant='h4'>Teams</Typography>
              </Grid>
              <Grid item>
                <Button variant='contained' component={Link} to='teams/new'>
                  Add team
                </Button>
              </Grid>
            </Grid>
          </div>

          <Card sx={{ padding: 2 }}>
            <Typography variant='h5'>Your Teams</Typography>
          </Card>
        </Stack>
      </Box>
    </Container>
  );
}
