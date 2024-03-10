import { Link } from 'react-router-dom';
import {
  Button,
  Grid,
  Container,
  Typography,
  Box,
  Card,
  Stack,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Chip,
} from '@mui/material';
import { getAllTeamsForUser, useQuery } from 'wasp/client/operations';

import type { User } from 'wasp/entities';

export default function TeamsPage({ user }: { user: User }) {
  const {
    data: teams,
    isLoading,
    error,
  } = useQuery(getAllTeamsForUser, {
    userId: user.id,
  });

  console.log(teams);
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
            {teams && teams?.length > 0 && (
              <Table>
                <TableBody>
                  {teams.map((team) => (
                    <TableRow key={team.team.id}>
                      <TableCell>
                        {team.team.name}{' '}
                        {team.status === 'ADMIN' && <Chip label='Admin' color='primary' size='small' />}
                      </TableCell>
                      <TableCell align='right'>
                        <Button component={Link} to='/'>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </Stack>
      </Box>
    </Container>
  );
}
