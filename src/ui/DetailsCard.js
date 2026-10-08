// Copyright (c) 2026 rmd Studio Inc. MIT License.
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import { creatureColor, formatAge } from '../constants';
import { glass } from '../theme';

function Row({ label, value }) {
  return (
    <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="caption" noWrap sx={{ maxWidth: 220 }}>
        {value}
      </Typography>
    </Stack>
  );
}

export default function DetailsCard({ node, connections, presentation, logPods, onGlide, onLogs, onClose }) {
  const rows = [
    !presentation && ['Namespace', node.namespace],
    ['Status', node.statusText],
    ['Age', formatAge(node.createdAt)],
    node.containers && ['Containers', node.containers.join(', ')],
    ...node.info.filter(([, value, sensitive]) => value && !(sensitive && presentation)),
    ['Connections', String(connections)],
  ].filter(Boolean);

  return (
    <Paper elevation={0} sx={{ ...glass, position: 'fixed', left: 12, bottom: 12, zIndex: 15, width: 320, p: 1.5 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, bgcolor: creatureColor(node) }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
            {node.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {node.kind}
          </Typography>
        </Box>
        <IconButton size="small" aria-label="Close details" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
      {rows.map(([label, value]) => (
        <Row key={label} label={label} value={value} />
      ))}
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button size="small" variant="outlined" onClick={onGlide}>
          Fly to
        </Button>
        {logPods > 0 && (
          <Button size="small" variant="outlined" onClick={onLogs}>
            {logPods > 1 ? `Logs (${logPods} pods)` : 'Logs'}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
