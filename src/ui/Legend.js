// Copyright (c) 2026 rmd Studio Inc. MIT License.
import { useState } from 'react';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { KINDS, STATUS, WIRES } from '../constants';
import { glass } from '../theme';

const CONTROLS = [
  ['Drag', 'look around'],
  ['W A S D / arrows', 'move'],
  ['Q / E', 'down / up'],
  ['Shift', 'faster'],
  ['Scroll', 'thrust'],
  ['Click', 'select · open logs'],
  ['Double-click', 'fly to'],
  ['F', 'full screen'],
  ['Esc', 'deselect'],
];

function Entry({ color, line, label, hint }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Box
        sx={{
          width: line ? 16 : 9,
          height: line ? 2 : 9,
          borderRadius: line ? 1 : '50%',
          bgcolor: color,
          flexShrink: 0,
        }}
      />
      <Typography variant="caption">{label}</Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Stack>
  );
}

function Section({ title, children }) {
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.8 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export default function Legend() {
  const [open, setOpen] = useState(true);
  return (
    <Paper elevation={0} sx={{ ...glass, position: 'fixed', right: 12, bottom: 12, zIndex: 15, width: 250, px: 1.5, py: 0.5 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Legend and controls
        </Typography>
        <IconButton size="small" aria-label="Toggle legend" onClick={() => setOpen((v) => !v)}>
          {open ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
        </IconButton>
      </Stack>
      <Collapse in={open}>
        <Box sx={{ pb: 1, maxHeight: '60vh', overflowY: 'auto' }}>
          <Section title="Creatures">
            {Object.entries(KINDS).map(([kind, k]) => (
              <Entry key={kind} color={k.color} label={k.label} hint={k.creature} />
            ))}
          </Section>
          <Section title="Health">
            {Object.entries(STATUS)
              .filter(([, s]) => s.color)
              .map(([key, s]) => (
                <Entry key={key} color={s.color} label={s.label} />
              ))}
          </Section>
          <Section title="Wires">
            {Object.entries(WIRES).map(([key, w]) => (
              <Entry key={key} line color={w.color} label={w.label} />
            ))}
          </Section>
          <Section title="Flying">
            {CONTROLS.map(([keys, action]) => (
              <Stack key={keys} direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography variant="caption">{keys}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {action}
                </Typography>
              </Stack>
            ))}
          </Section>
        </Box>
      </Collapse>
    </Paper>
  );
}
