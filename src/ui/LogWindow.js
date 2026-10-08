// Copyright (c) 2026 rmd Studio Inc. MIT License.
import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import NearMeIcon from '@mui/icons-material/NearMe';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import WrapTextIcon from '@mui/icons-material/WrapText';
import { creatureColor } from '../constants';
import { openLogStream } from '../k8s/api';
import { openDemoLogStream } from '../k8s/demo';
import { glass } from '../theme';

const MAX_LINES = 3000;
const TAILS = [100, 500, 2000];

// A floating window showing a pod's log. Opened from a pod it shows that pod;
// opened from something that runs pods (`owner`) it lets you pick among them.
// Drag it by the header; resize it from the bottom-right corner.
export default function LogWindow({ owner, pods, demo, index, zIndex, onFocus, onClose, onGlide }) {
  const [position, setPosition] = useState({ x: 40 + index * 36, y: 110 + index * 36 });
  const [podId, setPodId] = useState(pods[0].id);
  const node = pods.find((p) => p.id === podId) || pods[0];
  const [chosenContainer, setContainer] = useState('');
  const container = node.containers.includes(chosenContainer) ? chosenContainer : node.containers[0] || '';
  const [tail, setTail] = useState(TAILS[0]);
  const [follow, setFollow] = useState(true);
  const [wrap, setWrap] = useState(false);
  const [lines, setLines] = useState([]);
  const [note, setNote] = useState('Opening…');
  const body = useRef();
  const drag = useRef(null);
  const failing = node.status === 'failed';

  useEffect(() => {
    setLines([]);
    setNote('Opening…');
    const open = demo ? openDemoLogStream : openLogStream;
    return open({
      namespace: node.namespace,
      pod: node.name,
      container,
      failing,
      tailLines: tail,
      follow,
      onLines: (added) => {
        setNote('');
        setLines((prev) => prev.concat(added).slice(-MAX_LINES));
      },
      onError: (err) => setNote(`Could not read the log: ${err.message}`),
      onEnd: () => setNote(follow ? 'The stream ended.' : ''),
    });
  }, [demo, node.namespace, node.name, container, failing, tail, follow]);

  useEffect(() => {
    if (follow && body.current) body.current.scrollTop = body.current.scrollHeight;
  }, [lines, follow]);

  const startDrag = (e) => {
    if (e.target.closest('button, [role="combobox"]')) return;
    drag.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveDrag = (e) => {
    if (!drag.current) return;
    setPosition({
      x: Math.min(Math.max(e.clientX - drag.current.x, -400), window.innerWidth - 80),
      y: Math.min(Math.max(e.clientY - drag.current.y, 0), window.innerHeight - 40),
    });
  };
  const endDrag = () => {
    drag.current = null;
  };

  return (
    <Paper
      elevation={8}
      onPointerDown={onFocus}
      sx={{
        ...glass,
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex,
        width: 640,
        height: 360,
        minWidth: 360,
        minHeight: 160,
        maxWidth: '96vw',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        resize: 'both',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        sx={{
          alignItems: 'center',
          px: 1.5,
          py: 0.5,
          cursor: 'move',
          userSelect: 'none',
          touchAction: 'none',
          borderBottom: '1px solid rgba(120, 200, 255, 0.16)',
        }}
      >
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, bgcolor: creatureColor(node) }} />
        <Typography variant="body2" noWrap sx={{ fontWeight: 600, flexGrow: 1, minWidth: 60 }}>
          {owner.name}
        </Typography>
        {pods.length > 1 && (
          <Select
            size="small"
            variant="standard"
            disableUnderline
            value={node.id}
            onChange={(e) => setPodId(e.target.value)}
            sx={{ fontSize: 12, maxWidth: 190 }}
          >
            {pods.map((pod) => (
              <MenuItem key={pod.id} value={pod.id}>
                {pod.name}
              </MenuItem>
            ))}
          </Select>
        )}
        {node.containers.length > 1 && (
          <Select
            size="small"
            variant="standard"
            disableUnderline
            value={container}
            onChange={(e) => setContainer(e.target.value)}
            sx={{ fontSize: 12 }}
          >
            {node.containers.map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </Select>
        )}
        <Select
          size="small"
          variant="standard"
          disableUnderline
          value={tail}
          onChange={(e) => setTail(e.target.value)}
          sx={{ fontSize: 12 }}
        >
          {TAILS.map((n) => (
            <MenuItem key={n} value={n}>
              last {n}
            </MenuItem>
          ))}
        </Select>
        <Tooltip title="Follow new lines">
          <ToggleButton
            value="follow"
            size="small"
            selected={follow}
            onChange={() => setFollow((v) => !v)}
            sx={{ p: 0.25, border: 0 }}
          >
            <VerticalAlignBottomIcon fontSize="small" />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="Wrap long lines">
          <ToggleButton
            value="wrap"
            size="small"
            selected={wrap}
            onChange={() => setWrap((v) => !v)}
            sx={{ p: 0.25, border: 0 }}
          >
            <WrapTextIcon fontSize="small" />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="Fly to this pod">
          <IconButton size="small" onClick={() => onGlide(node.id)}>
            <NearMeIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <IconButton size="small" aria-label="Close log" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Box
        ref={body}
        component="pre"
        sx={{
          flexGrow: 1,
          m: 0,
          px: 1.5,
          py: 1,
          overflow: 'auto',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: 11.5,
          lineHeight: 1.5,
          color: '#cfe8f5',
          whiteSpace: wrap ? 'pre-wrap' : 'pre',
          wordBreak: wrap ? 'break-all' : 'normal',
        }}
      >
        {lines.join('\n')}
        {note && (
          <Box component="span" sx={{ display: 'block', color: 'text.secondary', fontStyle: 'italic' }}>
            {note}
          </Box>
        )}
      </Box>
    </Paper>
  );
}
