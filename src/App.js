// Copyright (c) 2026 rmd Studio Inc. MIT License.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { KINDS, isSystemNamespace } from './constants';
import { filterGraph, podsBehind } from './k8s/graph';
import { useCluster } from './k8s/useCluster';
import Ocean from './scene/Ocean';
import DetailsCard from './ui/DetailsCard';
import Legend from './ui/Legend';
import LogWindow from './ui/LogWindow';
import TopBar from './ui/TopBar';

// Each open log stream holds a browser connection; keep some free for polling.
const MAX_LOG_WINDOWS = 4;

// Clicking a creature opens logs for the pods it owns. Services and Ingresses
// only offer them from the details card.
const OWNS = ['owns'];
const REACHES = ['owns', 'routes'];

const isTyping = (target) => /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable;

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
}

export default function App() {
  const cluster = useCluster();
  const [selectedNamespaces, setSelectedNamespaces] = useState([]);
  const [kindsOn, setKindsOn] = useState(() => new Set(Object.keys(KINDS)));
  const [search, setSearch] = useState('');
  const [showLabels, setShowLabels] = useState(true);
  const [spacing, setSpacing] = useState(1);
  const [presentation, setPresentation] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [glide, setGlide] = useState(null);
  const [logs, setLogs] = useState([]);
  const [fullscreen, setFullscreen] = useState(false);

  const graph = cluster.graph;
  const byId = useMemo(() => new Map((graph?.nodes || []).map((n) => [n.id, n])), [graph]);
  const graphRef = useRef(graph);
  graphRef.current = graph;

  const namespaces = useMemo(() => [...new Set((graph?.nodes || []).map((n) => n.namespace))].sort(), [graph]);

  const inNamespaces = useCallback(
    (n) => (selectedNamespaces.length ? selectedNamespaces.includes(n.namespace) : !isSystemNamespace(n.namespace)),
    [selectedNamespaces]
  );

  const counts = useMemo(() => {
    const result = {};
    for (const n of graph?.nodes || []) if (inNamespaces(n)) result[n.kind] = (result[n.kind] || 0) + 1;
    return result;
  }, [graph, inNamespaces]);

  const visible = useMemo(
    () => graph && filterGraph(graph, (n) => kindsOn.has(n.kind) && inNamespaces(n)),
    [graph, kindsOn, inNamespaces]
  );

  const matchIds = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term || !visible) return null;
    return new Set(visible.nodes.filter((n) => n.name.toLowerCase().includes(term)).map((n) => n.id));
  }, [search, visible]);

  // Enter in the search field flies to the next match.
  const nextMatch = useRef(0);
  const visitMatch = () => {
    const found = matchIds ? visible.nodes.filter((n) => matchIds.has(n.id)) : [];
    if (!found.length) return;
    const node = found[nextMatch.current % found.length];
    nextMatch.current += 1;
    setSelectedId(node.id);
    setGlide({ id: node.id });
  };

  const openLogs = useCallback((id) => {
    setLogs((open) => [...open.filter((other) => other !== id), id].slice(-MAX_LOG_WINDOWS));
  }, []);
  const closeLogs = useCallback((id) => setLogs((open) => open.filter((other) => other !== id)), []);

  const select = useCallback(
    (id) => {
      setSelectedId(id);
      if (id && podsBehind(graphRef.current, id, OWNS).length) openLogs(id);
    },
    [openLogs]
  );
  const glideTo = useCallback((id) => setGlide({ id }), []);

  useEffect(() => {
    const onKey = (e) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'KeyF') toggleFullscreen();
      if (e.code === 'Escape') setSelectedId(null);
    };
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, []);

  const selected = visible?.nodes.find((n) => n.id === selectedId);
  const selectedPods = selected ? podsBehind(graph, selected.id, REACHES) : [];
  const connections = selected
    ? visible.links.filter((l) => l.source === selected.id || l.target === selected.id).length
    : 0;

  return (
    <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'background.default' }}>
      {visible ? (
        <Ocean
          graph={visible}
          selectedId={selected?.id || null}
          matchIds={matchIds}
          showLabels={showLabels}
          presentation={presentation}
          spacing={spacing}
          glide={glide}
          onSelect={select}
          onGlide={glideTo}
        />
      ) : (
        <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
          <CircularProgress />
        </Box>
      )}

      <TopBar
        cluster={cluster}
        counts={counts}
        namespaces={namespaces}
        selectedNamespaces={selectedNamespaces}
        onNamespaces={setSelectedNamespaces}
        kindsOn={kindsOn}
        onToggleKind={(kind) =>
          setKindsOn((on) => {
            const next = new Set(on);
            if (!next.delete(kind)) next.add(kind);
            return next;
          })
        }
        search={search}
        matches={matchIds ? matchIds.size : null}
        onSearch={(text) => {
          nextMatch.current = 0;
          setSearch(text);
        }}
        onSearchSubmit={visitMatch}
        spacing={spacing}
        onSpacing={setSpacing}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((v) => !v)}
        presentation={presentation}
        onTogglePresentation={() => setPresentation((v) => !v)}
        fullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      {selected && (
        <DetailsCard
          node={selected}
          connections={connections}
          presentation={presentation}
          logPods={selectedPods.length}
          onGlide={() => glideTo(selected.id)}
          onLogs={() => openLogs(selected.id)}
          onClose={() => setSelectedId(null)}
        />
      )}

      {!presentation && <Legend />}

      {logs.map((id, index) => {
        const owner = byId.get(id);
        const pods = owner ? podsBehind(graph, id, REACHES) : [];
        return (
          pods.length > 0 && (
            <LogWindow
              key={id}
              owner={owner}
              pods={pods}
              demo={cluster.mode === 'demo'}
              index={index}
              zIndex={20 + index}
              onFocus={() => index < logs.length - 1 && openLogs(id)}
              onGlide={glideTo}
              onClose={() => closeLogs(id)}
            />
          )
        );
      })}
    </Box>
  );
}
