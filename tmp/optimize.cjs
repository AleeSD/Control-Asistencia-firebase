const fs = require('fs');
function edit(path, fn) { const original=fs.readFileSync(path,'utf8'); fs.writeFileSync(path,fn(original.replace(/\r\n/g,'\n'))); }
function replace(s,a,b) { if(!s.includes(a)) throw Error('Anchor missing: '+a.slice(0,80)); return s.replace(a,b); }
edit('src/WorkerPortal.tsx', s=> {
 s=replace(s,'    const stopRequest = onSnapshot', '    return stopProfile;\n  }, [user.uid]);\n\n  useEffect(() => {\n    if (!db || profile === undefined || profile) return;\n    const stopRequest = onSnapshot');
 s=replace(s,'    return () => { stopProfile(); stopRequest(); };\n  }, [user.uid]);','    return stopRequest;\n  }, [user.uid, profile]);');
 s=replace(s,'  const [marks, setMarks]', '  const [marksReady, setMarksReady] = useState(false);\n  const [marks, setMarks]');
 const a=s.indexOf('    const stopMarks = onSnapshot'); const b=s.indexOf('\n  useEffect(() => {\n    const timer',a);
 s=s.slice(0,a)+`    setMarks([]); setMarksReady(false);
    const loaded = new Set<string>();
    const stops = (["entrada", "salida"] as const).map(type => {
      const id = profile.personnelId + "_" + today + "_" + type;
      return onSnapshot(doc(db!, "marks", id), snap => {
        setMarks(current => [...current.filter(m => m.id !== id), ...(snap.exists() ? [{ id: snap.id, ...snap.data() } as Mark] : [])]);
        loaded.add(type); setMarksReady(loaded.size === 2);
      }, error => { setMarksReady(false); setNotice(messageOf(error)); });
    });
    return () => stops.forEach(stop => stop());
  }, [profile?.personnelId, profile?.active, person?.active, person?.approvedUid, user.uid, today]);

  useEffect(() => {
    if (!db || !profile?.active || !profile.personnelId || !person?.active || person.approvedUid !== user.uid) return;
    return onSnapshot(query(collection(db, "incidents"), where("personnelId", "==", profile.personnelId), orderBy("createdAt", "desc"), limit(3)),
      snap => setIncidents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Incident))),
      error => setNotice(messageOf(error)));
  }, [profile?.personnelId, profile?.active, person?.active, person?.approvedUid, user.uid]);
` .replaceAll('\\`','`')+s.slice(b);
 s=replace(s,'if (profile === undefined || request === undefined)', 'if (profile === undefined || (!profile && request === undefined))');
 s=replace(s,'disabled={busy || Boolean(departure)}','disabled={busy || !marksReady || Boolean(departure)}');
 return s;
});
