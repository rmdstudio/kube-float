// Copyright (c) 2026 rmd Studio Inc. MIT License.
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import LabelIcon from '@mui/icons-material/Label';
import LabelOffIcon from '@mui/icons-material/LabelOff';
import SearchIcon from '@mui/icons-material/Search';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import { KINDS } from '../constants';
import { glass } from '../theme';

function Dot({ color }) {
  return <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, ml: 1 }} />;
}

function ModeChip({ cluster }) {
  if (cluster.mode === 'live') return <Chip size="small" color="success" variant="outlined" label="Live" />;
  if (cluster.mode === 'connecting') return <Chip size="small" variant="outlined" label="Connecting…" />;
  const chip = (
    <Chip
      size="small"
      color="warning"
      variant="outlined"
      label={cluster.canRetry ? 'Demo · retry live' : 'Demo'}
      onClick={cluster.canRetry ? cluster.retry : undefined}
    />
  );
  return cluster.error ? <Tooltip title={`No cluster reachable: ${cluster.error}`}>{chip}</Tooltip> : chip;
}

export default function TopBar({
  cluster,
  counts,
  namespaces,
  selectedNamespaces,
  onNamespaces,
  kindsOn,
  onToggleKind,
  search,
  matches,
  onSearch,
  onSearchSubmit,
  spacing,
  onSpacing,
  showLabels,
  onToggleLabels,
  presentation,
  onTogglePresentation,
  fullscreen,
  onToggleFullscreen,
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        ...glass,
        position: 'fixed',
        top: 12,
        left: 12,
        right: presentation ? 'auto' : 12,
        zIndex: 15,
        px: 2,
        py: 1,
      }}
    >
      <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: 0.5, color: 'primary.main' }}>
          kube-float
        </Typography>

        {!presentation && (
          <>
            <ModeChip cluster={cluster} />
            <Autocomplete
              multiple
              size="small"
              limitTags={2}
              options={namespaces}
              value={selectedNamespaces}
              onChange={(_, value) => onNamespaces(value)}
              sx={{ minWidth: 230, maxWidth: 420 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="standard"
                  placeholder={selectedNamespaces.length ? '' : 'All namespaces (system hidden)'}
                />
              )}
            />
            <TextField
              size="small"
              variant="standard"
              placeholder="Find by name"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
              sx={{ width: 200 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: matches !== null && (
                    <InputAdornment position="end">
                      <Typography variant="caption" color={matches ? 'primary' : 'error'} noWrap>
                        {matches ? `${matches} found · Enter` : 'none'}
                      </Typography>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Tooltip title="Spacing: bring everything closer together or further apart">
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', width: 150 }}>
                <ZoomInMapIcon fontSize="small" color="action" />
                <Slider
                  size="small"
                  aria-label="Spacing"
                  min={0.4}
                  max={3}
                  step={0.1}
                  value={spacing}
                  onChange={(_, value) => onSpacing(value)}
                />
                <ZoomOutMapIcon fontSize="small" color="action" />
              </Stack>
            </Tooltip>
            <Tooltip title={showLabels ? 'Hide name labels' : 'Show name labels'}>
              <IconButton size="small" onClick={onToggleLabels}>
                {showLabels ? <LabelIcon /> : <LabelOffIcon />}
              </IconButton>
            </Tooltip>
          </>
        )}

        <Tooltip title={presentation ? 'Leave presentation mode' : 'Presentation mode: hide controls and infrastructure details'}>
          <IconButton size="small" color={presentation ? 'primary' : 'default'} onClick={onTogglePresentation}>
            <SlideshowIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={fullscreen ? 'Leave full screen (F)' : 'Full screen (F)'}>
          <IconButton size="small" onClick={onToggleFullscreen}>
            {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </Tooltip>
        {!presentation && (
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', flexGrow: 1 }}>
            {Object.entries(KINDS).map(([kind, { label, color }]) => (
              <Chip
                key={kind}
                size="small"
                icon={<Dot color={kindsOn.has(kind) ? color : 'transparent'} />}
                label={`${label} ${counts[kind] || 0}`}
                variant={kindsOn.has(kind) ? 'filled' : 'outlined'}
                onClick={() => onToggleKind(kind)}
                sx={{ opacity: kindsOn.has(kind) ? 1 : 0.5 }}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
