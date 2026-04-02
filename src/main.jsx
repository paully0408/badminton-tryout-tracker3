import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

const STORAGE_KEY = "badminton_tryout_tracker_deploy_v2";
const TEAM_TARGET = 11;
const APP_VERSION = "deploy-b1";

const STATUS_META = {
  yes: { short: "Y", color: "#16a34a", text: "#ffffff", order: 0 },
  maybe: { short: "M", color: "#facc15", text: "#111827", order: 1 },
  cut: { short: "C", color: "#dc2626", text: "#ffffff", order: 2 },
  undecided: { short: "", color: "#ffffff", text: "#475569", order: 3 },
};

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id_" + Math.random().toString(36).slice(2) + Date.now();
}

function emptyTryout(name = "New Tryout") {
  return {
    id: createId(),
    name,
    rawNames: "",
    students: [],
    matches: [],
  };
}

function normalizeLine(line) {
  return line.replace(/\t+/g, " ").trim();
}

function parseLine(line, index) {
  const cleaned = normalizeLine(line);
  if (!cleaned) return null;
  const trailing = cleaned.match(/^(.*?)(?:\s*[,-]?\s*)(\d+)$/);
  if (trailing) {
    const name = trailing[1].trim().replace(/[,-]\s*$/, "");
    const num = Number(trailing[2]);
    if (name) {
      return {
        id: createId(),
        name,
        tagNumber: num,
        seedOrder: index,
        status: "undecided",
        points: 0,
        wins: 0,
        losses: 0,
      };
    }
  }
  return {
    id: createId(),
    name: cleaned,
    tagNumber: null,
    seedOrder: index,
    status: "undecided",
    points: 0,
    wins: 0,
    losses: 0,
  };
}

function displayName(student) {
  if (!student) return "Unknown player";
  return student.tagNumber === null || student.tagNumber === undefined
    ? student.name
    : `#${student.tagNumber} ${student.name}`;
}

function sortOriginal(students) {
  return [...students].sort((a, b) => a.seedOrder - b.seedOrder);
}

function getScoreBands(students, target = TEAM_TARGET) {
  if (!students.length) return { greenThreshold: null, yellowThreshold: null };
  const scores = [...students].map((s) => s.points || 0).sort((a, b) => b - a);
  const greenThreshold = scores[Math.min(target - 1, scores.length - 1)];
  const tiedAtCutoff = scores.slice(target).some((s) => s === greenThreshold);
  return {
    greenThreshold,
    yellowThreshold: tiedAtCutoff ? greenThreshold : null,
  };
}

function getRankBand(student, greenThreshold, yellowThreshold) {
  const points = student.points || 0;
  if (greenThreshold === null) return "neutral";
  if (points > greenThreshold) return "green";
  if (points === greenThreshold) return yellowThreshold === greenThreshold ? "yellow" : "green";
  return "red";
}

function sortRanking(students, greenThreshold, yellowThreshold) {
  const bandOrder = { green: 0, yellow: 1, red: 2, neutral: 3 };
  return [...students].sort((a, b) => {
    const bandCompare =
      bandOrder[getRankBand(a, greenThreshold, yellowThreshold)] -
      bandOrder[getRankBand(b, greenThreshold, yellowThreshold)];
    if (bandCompare !== 0) return bandCompare;
    const pointsCompare = (b.points || 0) - (a.points || 0);
    if (pointsCompare !== 0) return pointsCompare;
    const winsCompare = (b.wins || 0) - (a.wins || 0);
    if (winsCompare !== 0) return winsCompare;
    return a.seedOrder - b.seedOrder;
  });
}

function cardClass(student, greenThreshold, yellowThreshold) {
  const band = getRankBand(student, greenThreshold, yellowThreshold);
  if (band === "green") return "student-card green";
  if (band === "yellow") return "student-card yellow";
  if (band === "red") return "student-card red";
  return "student-card";
}

function TouchButton({ className = "", title, onPress, children, disabled = false }) {
  const trigger = (e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    onPress?.();
  };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      className={className}
      onPointerUp={trigger}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {children}
    </button>
  );
}

function StatusButton({ tone, active, onPress }) {
  const meta = STATUS_META[tone];
  const style = active
    ? { background: meta.color, color: meta.text, borderColor: meta.color }
    : undefined;
  return (
    <TouchButton className="mini-status-button" onPress={onPress} title={tone}>
      <span style={style} className="mini-status-inner">{meta.short}</span>
    </TouchButton>
  );
}

function CounterButton({ onPress, title, children }) {
  return (
    <TouchButton className="counter-button" onPress={onPress} title={title}>
      {children}
    </TouchButton>
  );
}

function MatchSelectButton({ selected, onPress }) {
  return (
    <TouchButton className={"match-select " + (selected ? "selected" : "")} onPress={onPress} title="Select for match">
      {selected ? "✓" : ""}
    </TouchButton>
  );
}

function StudentCard({
  student,
  greenThreshold,
  yellowThreshold,
  selectedForMatch,
  onToggleMatchSelection,
  onStatusChange,
  onPointsChange,
}) {
  return (
    <div className={cardClass(student, greenThreshold, yellowThreshold)}>
      <div className="student-top-row">
        <div className="student-status-column">
          <StatusButton
            tone="yes"
            active={student.status === "yes"}
            onPress={() => onStatusChange(student.id, student.status === "yes" ? "undecided" : "yes")}
          />
          <StatusButton
            tone="maybe"
            active={student.status === "maybe"}
            onPress={() => onStatusChange(student.id, student.status === "maybe" ? "undecided" : "maybe")}
          />
          <StatusButton
            tone="cut"
            active={student.status === "cut"}
            onPress={() => onStatusChange(student.id, student.status === "cut" ? "undecided" : "cut")}
          />
        </div>

        <div className="student-center">
          <div className="student-stat">Wins: {student.wins || 0}</div>
          <div className="student-name">{displayName(student)}</div>
          <div className="student-stat">Losses: {student.losses || 0}</div>
        </div>

        <div className="student-right-top">
          <MatchSelectButton
            selected={selectedForMatch}
            onPress={() => onToggleMatchSelection(student.id)}
          />
        </div>
      </div>

      <div className="student-bottom-row">
        <div className="spacer-left" />
        <div className="points-pill">{student.points}</div>
        <div className="points-controls">
          <CounterButton onPress={() => onPointsChange(student.id, 1)} title="Add point">+</CounterButton>
          <CounterButton onPress={() => onPointsChange(student.id, -1)} title="Subtract point">−</CounterButton>
        </div>
      </div>
    </div>
  );
}

function App() {
  const fileInputRef = useRef(null);
  const [tryouts, setTryouts] = useState([emptyTryout("Badminton Tryout 1")]);
  const [selectedTryoutId, setSelectedTryoutId] = useState(null);
  const [newTryoutName, setNewTryoutName] = useState("");
  const [sortMode, setSortMode] = useState("original");
  const [exportMessage, setExportMessage] = useState("");
  const [backupJson, setBackupJson] = useState("");
  const [selectedMatchIds, setSelectedMatchIds] = useState([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const savedTryouts = parsed.tryouts?.length ? parsed.tryouts : [emptyTryout("Badminton Tryout 1")];
        setTryouts(savedTryouts);
        setSelectedTryoutId(parsed.selectedTryoutId || savedTryouts[0].id);
        return;
      } catch {}
    }
    const initial = [emptyTryout("Badminton Tryout 1")];
    setTryouts(initial);
    setSelectedTryoutId(initial[0].id);
  }, []);

  useEffect(() => {
    if (!selectedTryoutId && tryouts.length) setSelectedTryoutId(tryouts[0].id);
  }, [tryouts, selectedTryoutId]);

  useEffect(() => {
    if (!selectedTryoutId) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tryouts, selectedTryoutId }));
  }, [tryouts, selectedTryoutId]);

  const currentTryout = useMemo(
    () => tryouts.find((t) => t.id === selectedTryoutId) || tryouts[0] || null,
    [tryouts, selectedTryoutId]
  );

  const students = currentTryout?.students || [];
  const matches = currentTryout?.matches || [];
  const rawNames = currentTryout?.rawNames || "";
  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const { greenThreshold, yellowThreshold } = useMemo(() => getScoreBands(students, TEAM_TARGET), [students]);

  const displayedStudents = useMemo(() => {
    return sortMode === "ranking"
      ? sortRanking(students, greenThreshold, yellowThreshold)
      : sortOriginal(students);
  }, [students, sortMode, greenThreshold, yellowThreshold]);

  const groupedCounts = useMemo(() => ({
    yes: students.filter((s) => s.status === "yes").length,
    maybe: students.filter((s) => s.status === "maybe").length,
    cut: students.filter((s) => s.status === "cut").length,
    undecided: students.filter((s) => s.status === "undecided").length,
  }), [students]);

  const greenPlayers = useMemo(() => students.filter((s) => getRankBand(s, greenThreshold, yellowThreshold) === "green"), [students, greenThreshold, yellowThreshold]);
  const yellowPlayers = useMemo(() => students.filter((s) => getRankBand(s, greenThreshold, yellowThreshold) === "yellow"), [students, greenThreshold, yellowThreshold]);
  const redPlayers = useMemo(() => students.filter((s) => getRankBand(s, greenThreshold, yellowThreshold) === "red"), [students, greenThreshold, yellowThreshold]);

  const pendingMatch = useMemo(() => {
    if (selectedMatchIds.length !== 2) return null;
    const [playerAId, playerBId] = selectedMatchIds;
    if (playerAId === playerBId) return null;
    return { playerAId, playerBId };
  }, [selectedMatchIds]);

  function updateCurrentTryout(updater) {
    if (!currentTryout) return;
    setTryouts((prev) => prev.map((t) => (t.id === currentTryout.id ? updater(t) : t)));
  }

  function setRawNamesValue(value) {
    updateCurrentTryout((t) => ({ ...t, rawNames: value }));
  }

  function importNames() {
    const lines = rawNames.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const nextStudents = lines.map((line, index) => parseLine(line, index + 1)).filter(Boolean);
    updateCurrentTryout((t) => ({ ...t, students: nextStudents, matches: [] }));
    setSortMode("original");
    setSelectedMatchIds([]);
    setExportMessage("");
  }

  function clearCurrentTryout() {
    updateCurrentTryout((t) => ({ ...t, rawNames: "", students: [], matches: [] }));
    setSortMode("original");
    setSelectedMatchIds([]);
    setExportMessage("");
  }

  function addTryout() {
    const next = emptyTryout(newTryoutName.trim() || `Badminton Tryout ${tryouts.length + 1}`);
    setTryouts((prev) => [...prev, next]);
    setSelectedTryoutId(next.id);
    setNewTryoutName("");
    setSortMode("original");
    setSelectedMatchIds([]);
    setExportMessage("");
    setBackupJson("");
  }

  function renameTryout(id, name) {
    setTryouts((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
  }

  function deleteTryout(id) {
    if (tryouts.length === 1) {
      const replacement = emptyTryout("Badminton Tryout 1");
      setTryouts([replacement]);
      setSelectedTryoutId(replacement.id);
      setSortMode("original");
      setSelectedMatchIds([]);
      return;
    }
    const remaining = tryouts.filter((t) => t.id !== id);
    setTryouts(remaining);
    if (selectedTryoutId === id) {
      setSelectedTryoutId(remaining[0].id);
      setSortMode("original");
      setSelectedMatchIds([]);
    }
  }

  function updateStudentStatus(id, status) {
    updateCurrentTryout((t) => ({
      ...t,
      students: t.students.map((s) => (s.id === id ? { ...s, status } : s)),
    }));
  }

  function updateStudentPoints(id, delta) {
    updateCurrentTryout((t) => ({
      ...t,
      students: t.students.map((s) => (s.id === id ? { ...s, points: (s.points || 0) + delta } : s)),
    }));
  }

  function toggleMatchSelection(studentId) {
    setSelectedMatchIds((prev) => {
      if (prev.includes(studentId)) return prev.filter((id) => id !== studentId);
      if (prev.length >= 2) return [...prev.slice(1), studentId];
      return [...prev, studentId];
    });
  }

  function createPendingMatch() {
    if (!pendingMatch) return;
    const duplicate = matches.some(
      (m) =>
        !m.completed &&
        ((m.playerAId === pendingMatch.playerAId && m.playerBId === pendingMatch.playerBId) ||
          (m.playerAId === pendingMatch.playerBId && m.playerBId === pendingMatch.playerAId))
    );
    if (duplicate) return;
    updateCurrentTryout((t) => ({
      ...t,
      matches: [
        {
          id: createId(),
          playerAId: pendingMatch.playerAId,
          playerBId: pendingMatch.playerBId,
          winnerId: null,
          completed: false,
        },
        ...t.matches,
      ],
    }));
  }

  function resolveMatch(matchId, winnerId) {
    const match = matches.find((m) => m.id === matchId);
    if (!match || match.completed) return;
    const loserId = match.playerAId === winnerId ? match.playerBId : match.playerAId;
    updateCurrentTryout((t) => ({
      ...t,
      students: t.students.map((s) => {
        if (s.id === winnerId) return { ...s, wins: (s.wins || 0) + 1, points: (s.points || 0) + 1 };
        if (s.id === loserId) return { ...s, losses: (s.losses || 0) + 1 };
        return s;
      }),
      matches: t.matches.map((m) => (m.id === matchId ? { ...m, winnerId, completed: true } : m)),
    }));
    setSelectedMatchIds([]);
  }

  function buildPayload() {
    return { exportedAt: new Date().toISOString(), tryouts, selectedTryoutId };
  }

  async function exportTryouts() {
    setIsExporting(true);
    setExportMessage("");
    try {
      const payload = buildPayload();
      const fileName = `badminton-tryouts-${new Date().toISOString().slice(0, 10)}.json`;
      const jsonText = JSON.stringify(payload, null, 2);
      setBackupJson(jsonText);

      const blob = new Blob([jsonText], { type: "application/json" });
      const file = new File([blob], fileName, { type: "application/json" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName, text: "Badminton tryout backup" });
        setExportMessage("Share sheet opened. Save the file to Files.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      setExportMessage("Backup JSON prepared below. If no file downloaded, use Copy Backup JSON.");
    } catch (err) {
      console.error(err);
      setBackupJson(JSON.stringify(buildPayload(), null, 2));
      setExportMessage("File export failed here. Use Copy Backup JSON as a fallback backup.");
    } finally {
      setIsExporting(false);
    }
  }

  async function copyBackupJson() {
    try {
      const json = backupJson || JSON.stringify(buildPayload(), null, 2);
      await navigator.clipboard.writeText(json);
      setBackupJson(json);
      setExportMessage("Backup JSON copied. Paste it into Notes or a file as a fallback backup.");
    } catch {
      setExportMessage("Copy failed on this device.");
    }
  }

  function triggerImport() {
    fileInputRef.current?.click();
  }

  function importBackupJson() {
    if (!backupJson.trim()) {
      setExportMessage("Paste backup JSON into the backup box first.");
      return;
    }
    try {
      const parsed = JSON.parse(backupJson);
      if (Array.isArray(parsed.tryouts) && parsed.tryouts.length > 0) {
        setTryouts(parsed.tryouts);
        setSelectedTryoutId(parsed.selectedTryoutId || parsed.tryouts[0].id);
        setSortMode("original");
        setSelectedMatchIds([]);
        setExportMessage("Backup JSON imported.");
      } else {
        setExportMessage("That JSON does not contain tryout data.");
      }
    } catch {
      setExportMessage("Backup JSON could not be parsed.");
    }
  }

  function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        if (Array.isArray(parsed.tryouts) && parsed.tryouts.length > 0) {
          setTryouts(parsed.tryouts);
          setSelectedTryoutId(parsed.selectedTryoutId || parsed.tryouts[0].id);
          setSortMode("original");
          setSelectedMatchIds([]);
          setBackupJson(String(reader.result || ""));
          setExportMessage("Import complete.");
        }
      } catch {
        setExportMessage("Import failed. Use a tryout export JSON file.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  if (!currentTryout) return null;

  return (
    <div className="app-shell">
      <div className="app-wrap">
        <input ref={fileInputRef} type="file" accept="application/json" className="hidden-input" onChange={handleImportFile} />

        <div className="header-row">
          <div>
            <div className="title-row">
              <h1>Badminton Tryout Tracker</h1>
              <span className="pill neutral">{APP_VERSION}</span>
            </div>
            <p className="subtext">Tally-based boys tryout tool built to help narrow the list down to 11 players.</p>
          </div>
          <div className="pill-row">
            <span className="pill green">Yes: {groupedCounts.yes}</span>
            <span className="pill yellow">Maybe: {groupedCounts.maybe}</span>
            <span className="pill red">Cut: {groupedCounts.cut}</span>
            <span className="pill neutral">Unmarked: {groupedCounts.undecided}</span>
          </div>
        </div>

        <section className="panel">
          <h2>Tryout Files</h2>
          <div className="files-grid">
            <div>
              <div className="create-row">
                <input value={newTryoutName} onChange={(e) => setNewTryoutName(e.target.value)} placeholder="New tryout name" />
                <button className="action-btn" onClick={addTryout}>Add</button>
              </div>
              <div className="tryout-grid">
                {tryouts.map((tryout) => (
                  <div key={tryout.id} className={"tryout-card " + (selectedTryoutId === tryout.id ? "selected" : "") }>
                    <button
                      className="tryout-select"
                      onClick={() => {
                        setSelectedTryoutId(tryout.id);
                        setSortMode("original");
                        setSelectedMatchIds([]);
                        setExportMessage("");
                      }}
                    >
                      {tryout.name}
                    </button>
                    <div className="tryout-edit-row">
                      <input value={tryout.name} onChange={(e) => renameTryout(tryout.id, e.target.value)} />
                      <button className="danger-btn" onClick={() => deleteTryout(tryout.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sidebar-stack">
              <button className="action-btn" onClick={exportTryouts} disabled={isExporting}>
                {isExporting ? "Exporting..." : "Export All Tryouts"}
              </button>
              <button className="secondary-btn" onClick={copyBackupJson}>Copy Backup JSON</button>
              <button className="secondary-btn" onClick={triggerImport}>Import Saved File</button>
              <div className="note-box">Export tries Files/share first. If that fails, use the backup JSON box below.</div>
              {exportMessage ? <div className="message-box">{exportMessage}</div> : null}
            </div>
          </div>

          <div className="backup-section">
            <button className="secondary-btn small" onClick={importBackupJson}>Import Backup JSON</button>
            <textarea
              value={backupJson}
              onChange={(e) => setBackupJson(e.target.value)}
              placeholder="Backup JSON appears here after export. You can also paste backup JSON here and use Import Backup JSON."
            />
          </div>
        </section>

        <section className="panel">
          <h2>Import Students</h2>
          <div className="import-grid">
            <textarea
              value={rawNames}
              onChange={(e) => setRawNamesValue(e.target.value)}
              placeholder={"Paste one player per line\nSmith, Ava 12\nChen, Noah 7\nMila Brown 4"}
            />
            <div className="sidebar-stack">
              <button className="action-btn" onClick={importNames}>Build List</button>
              <button className="danger-btn" onClick={clearCurrentTryout}>Clear This Tryout</button>
            </div>
          </div>
          <p className="help-text">Each line becomes one player. The number at the end of the line becomes the player's tag number if one is provided.</p>
        </section>

        <section className="panel">
          <div className="panel-top-row">
            <h2>{currentTryout.name} — Student List</h2>
            <div className="pill-row">
              <span className="pill green">Green now: {greenPlayers.length}</span>
              <span className="pill yellow">Yellow tie group: {yellowPlayers.length}</span>
              <span className="pill red">Red: {redPlayers.length}</span>
              <button className="secondary-btn small" onClick={() => setSortMode("ranking")}>Resort by Ranking</button>
              <button className="secondary-btn small" onClick={() => setSortMode("original")}>Show Original Order</button>
            </div>
          </div>

          {displayedStudents.length === 0 ? (
            <div className="empty-box">Paste player lines above, then tap <strong>Build List</strong>.</div>
          ) : (
            <>
              <div className="help-block">
                <div>Whole-card colors come from points only.</div>
                <div>Left mini-buttons keep your personal Yes / Maybe / Cut notes separate.</div>
                <div>Green = clearly in the top 11. Yellow = tied at the cutoff. Red = below the cutoff.</div>
                <div>Use the top-right square to choose two players for a match. The match stays editable until you select a winner.</div>
              </div>

              <div className="student-grid">
                {displayedStudents.map((student) => (
                  <StudentCard
                    key={student.id}
                    student={student}
                    greenThreshold={greenThreshold}
                    yellowThreshold={yellowThreshold}
                    selectedForMatch={selectedMatchIds.includes(student.id)}
                    onToggleMatchSelection={toggleMatchSelection}
                    onStatusChange={updateStudentStatus}
                    onPointsChange={updateStudentPoints}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <section className="panel">
          <h2>Activity Tracker</h2>

          {pendingMatch ? (
            <div className="pending-box">
              Pending match: <strong>{displayName(studentMap.get(pendingMatch.playerAId))}</strong> vs <strong>{displayName(studentMap.get(pendingMatch.playerBId))}</strong>
              <div className="pending-actions">
                <button className="action-btn small" onClick={createPendingMatch}>Create Match</button>
              </div>
            </div>
          ) : null}

          {matches.length === 0 ? (
            <div className="empty-box">Select two players with the match boxes to prepare a match.</div>
          ) : (
            <div className="match-list">
              {matches.map((match) => {
                const playerA = studentMap.get(match.playerAId);
                const playerB = studentMap.get(match.playerBId);
                if (!playerA || !playerB) return null;
                return (
                  <div key={match.id} className="match-card">
                    <div className="match-grid">
                      <button
                        type="button"
                        disabled={match.completed}
                        onClick={() => resolveMatch(match.id, playerA.id)}
                        className={"match-player " + (match.winnerId === playerA.id ? "winner" : "")}
                      >
                        {displayName(playerA)}
                      </button>
                      <button
                        type="button"
                        disabled={match.completed}
                        onClick={() => resolveMatch(match.id, playerB.id)}
                        className={"match-player " + (match.winnerId === playerB.id ? "winner" : "")}
                      >
                        {displayName(playerB)}
                      </button>
                    </div>
                    <div className="match-note">
                      {match.completed
                        ? "Match completed. Winner got a win, a tally point, and the loser got a loss."
                        : "Tap the winner to record the result."}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

