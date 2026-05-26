import { useState, useMemo, useEffect } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "./supabase";

const CULORI_CHELTUIELI = ["#e05c4a","#e8954a","#e8c94a","#6dbf67","#4a90d9","#9b6dbf","#bf6d9b","#4abfbf"];
const CULORI_VENITURI = ["#2ecc71","#27ae60","#1abc9c","#16a085"];
const CULORI_PERSOANE = { "Adrian": "#4a90d9", "Sorina": "#e8954a", "Ambii": "#9b6dbf" };

const CATEGORII_CHELTUIELI = ["Cumpărături","Transport","Credit","Asigurări/Pensie","Lifestyle / Distracție","Farmacie/Sănătate","Utilități"];
const CATEGORII_VENITURI = ["Salariu","Bonuri de masă","Investiții","Chirie primită","Alte venituri"];
const PERSOANE = ["Adrian","Sorina","Ambii"];

const LUNI = ["Ian","Feb","Mar","Apr","Mai","Iun","Iul","Aug","Sep","Oct","Nov","Dec"];
const ANI = Array.from({ length: 75 }, (_, i) => 2026 + i);

function formatRon(val) {
  return new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(val);
}

function BaraProcentaj({ label, procent, culoare }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: "#aaa" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: culoare }}>{procent}%</span>
      </div>
      <div style={{ background: "#12141c", borderRadius: 4, height: 6, overflow: "hidden" }}>
        <div style={{ width: `${procent}%`, background: culoare, height: "100%", borderRadius: 4, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

export default function App() {
  const azi = new Date();
  const [tab, setTab] = useState("dashboard");
  const [lunaSelectata, setLunaSelectata] = useState(azi.getMonth());
  const [anSelectat, setAnSelectat] = useState(azi.getFullYear());
  const [tranzactii, setTranzactii] = useState([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    tip: "cheltuiala", categorie: CATEGORII_CHELTUIELI[0],
    suma: "", descriere: "", luna: azi.getMonth(), an: azi.getFullYear(), persoana: "Adrian"
  });

  // Incarca tranzactii din Supabase
  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase.from("tranzactii").select("*").order("id", { ascending: false });
      if (!error) setTranzactii(data);
      setLoading(false);
    }
    load();

    // Asculta schimbari in timp real
    const channel = supabase
      .channel("tranzactii-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tranzactii" }, () => load())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  function selectLuna(i) { setLunaSelectata(i); setForm(f => ({ ...f, luna: i })); }
  function selectAn(a) { setAnSelectat(a); setForm(f => ({ ...f, an: a })); }

  const tranzactiiLuna = useMemo(
    () => tranzactii.filter(t => t.luna === lunaSelectata && t.an === anSelectat),
    [tranzactii, lunaSelectata, anSelectat]
  );

  const totalVenituri = useMemo(() => tranzactiiLuna.filter(t => t.tip === "venit").reduce((s, t) => s + t.suma, 0), [tranzactiiLuna]);
  const totalCheltuieli = useMemo(() => tranzactiiLuna.filter(t => t.tip === "cheltuiala").reduce((s, t) => s + t.suma, 0), [tranzactiiLuna]);
  const economii = totalVenituri - totalCheltuieli;

  const procentePersoane = useMemo(() => {
    const cheltuieli = tranzactiiLuna.filter(t => t.tip === "cheltuiala");
    const total = cheltuieli.reduce((s, t) => s + t.suma, 0);
    if (total === 0) return null;
    const result = {};
    PERSOANE.forEach(p => {
      const suma = cheltuieli.filter(t => t.persoana === p).reduce((s, t) => s + t.suma, 0);
      result[p] = Math.round((suma / total) * 100);
    });
    return result;
  }, [tranzactiiLuna]);

  const dataPie = useMemo(() => {
    const grouped = {};
    tranzactiiLuna.filter(t => t.tip === "cheltuiala").forEach(t => {
      grouped[t.categorie] = (grouped[t.categorie] || 0) + t.suma;
    });
    return Object.entries(grouped).map(([name, value]) => ({ name, value }));
  }, [tranzactiiLuna]);

  const dataVenituri = useMemo(() => {
    const grouped = {};
    tranzactiiLuna.filter(t => t.tip === "venit").forEach(t => {
      grouped[t.categorie] = (grouped[t.categorie] || 0) + t.suma;
    });
    return Object.entries(grouped).map(([name, value]) => ({ name, value }));
  }, [tranzactiiLuna]);

  const dataBar = useMemo(() => {
    return LUNI.map((luna, i) => {
      const v = tranzactii.filter(t => t.tip === "venit" && t.luna === i && t.an === anSelectat).reduce((s, t) => s + t.suma, 0);
      const c = tranzactii.filter(t => t.tip === "cheltuiala" && t.luna === i && t.an === anSelectat).reduce((s, t) => s + t.suma, 0);
      return { luna, Venituri: v, Cheltuieli: c };
    });
  }, [tranzactii, anSelectat]);

  async function adaugaTranzactie() {
    if (!form.suma || isNaN(Number(form.suma))) return;
    const { error } = await supabase.from("tranzactii").insert([{
      tip: form.tip, categorie: form.categorie, suma: Number(form.suma),
      descriere: form.descriere, luna: form.luna, an: form.an, persoana: form.persoana
    }]);
    if (!error) {
      setForm(f => ({ ...f, suma: "", descriere: "" }));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    }
  }

  async function stergeTranzactie(id) {
    await supabase.from("tranzactii").delete().eq("id", id);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", fontFamily: "'DM Sans', sans-serif", color: "#e8e4dc" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #1a1d26; }
        ::-webkit-scrollbar-thumb { background: #3a3d4a; border-radius: 2px; }
        input, select { outline: none; }
        .card { background: #1a1d26; border: 1px solid #2a2d3a; border-radius: 16px; padding: 24px; }
        .nav-btn { background: none; border: none; cursor: pointer; padding: 10px 20px; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; transition: all 0.2s; color: #888; }
        .nav-btn.active { background: #2a2d3a; color: #e8e4dc; }
        .nav-btn:hover:not(.active) { color: #bbb; }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .badge-venit { background: #1a3a2a; color: #2ecc71; }
        .badge-cheltuiala { background: #3a1a1a; color: #e05c4a; }
        .input-field { background: #12141c; border: 1px solid #2a2d3a; border-radius: 10px; padding: 10px 14px; color: #e8e4dc; font-family: 'DM Sans', sans-serif; font-size: 14px; width: 100%; transition: border 0.2s; }
        .input-field:focus { border-color: #4a90d9; }
        .btn-add { background: #4a90d9; border: none; color: white; padding: 11px 24px; border-radius: 10px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; transition: all 0.2s; }
        .btn-add:hover { background: #3a7bc8; transform: translateY(-1px); }
        .btn-delete { background: none; border: 1px solid #2a2d3a; color: #666; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: all 0.2s; }
        .btn-delete:hover { border-color: #e05c4a; color: #e05c4a; }
        .luna-btn { background: none; border: 1px solid #2a2d3a; color: #888; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px; font-family: 'DM Sans', sans-serif; transition: all 0.2s; }
        .luna-btn.activa { background: #2a2d3a; color: #e8e4dc; border-color: #4a90d9; }
        .luna-btn:hover:not(.activa) { color: #bbb; }
        .stat-card { background: #1a1d26; border: 1px solid #2a2d3a; border-radius: 14px; padding: 20px; }
        .tip-btn { flex: 1; padding: 9px; border: 1px solid #2a2d3a; border-radius: 8px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; transition: all 0.2s; background: none; color: #888; }
        .tip-btn.activ-venit { background: #1a3a2a; border-color: #2ecc71; color: #2ecc71; }
        .tip-btn.activ-cheltuiala { background: #3a1a1a; border-color: #e05c4a; color: #e05c4a; }
        .recharts-legend-item-text { font-size: 13px !important; }
        .recharts-tooltip-wrapper { filter: none !important; }
        .recharts-default-tooltip { background: #ffffff !important; border: 1px solid #ddd !important; border-radius: 8px !important; }
        .recharts-tooltip-label { font-size: 13px !important; color: #111 !important; font-weight: 600 !important; }
        .recharts-tooltip-item { color: #333 !important; font-size: 13px !important; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#12141c", borderBottom: "1px solid #2a2d3a", padding: "0 24px" }}>
        <div style={{ maxWidth: 920, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, background: "linear-gradient(135deg, #4a90d9, #2ecc71)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>₿</div>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700 }}>Finanțe Acasă</span>
          </div>
          <nav style={{ display: "flex", gap: 4 }}>
            {[["dashboard","📊 Dashboard"],["tranzactii","💳 Tranzacții"],["adauga","＋ Adaugă"]].map(([key, label]) => (
              <button key={key} className={`nav-btn ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>{label}</button>
            ))}
          </nav>
        </div>
      </div>

      <div style={{ maxWidth: 920, margin: "0 auto", padding: "28px 24px" }}>

        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>Se încarcă datele...</div>
        )}

        {!loading && <>
          {/* An + Luna selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#555", fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase" }}>An</span>
              <select className="input-field" value={anSelectat} onChange={e => selectAn(Number(e.target.value))} style={{ width: 110 }}>
                {ANI.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#555", fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase", marginRight: 4 }}>Luna</span>
              {LUNI.map((l, i) => (
                <button key={i} className={`luna-btn ${lunaSelectata === i ? "activa" : ""}`} onClick={() => selectLuna(i)}>{l}</button>
              ))}
            </div>
          </div>

          {/* DASHBOARD */}
          {tab === "dashboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {[
                  { label: "Venituri totale", val: totalVenituri, color: "#2ecc71", icon: "↑" },
                  { label: "Cheltuieli totale", val: totalCheltuieli, color: "#e05c4a", icon: "↓" },
                  { label: "Economii", val: economii, color: economii >= 0 ? "#4a90d9" : "#e8954a", icon: economii >= 0 ? "✓" : "!" },
                ].map(({ label, val, color, icon }) => (
                  <div className="stat-card" key={label}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <span style={{ fontSize: 13, color: "#888" }}>{label}</span>
                      <span style={{ width: 28, height: 28, background: color + "20", color, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{icon}</span>
                    </div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color }}>{formatRon(val)}</div>
                  </div>
                ))}
              </div>

              {procentePersoane && totalCheltuieli > 0 && (
                <div className="card">
                  <div style={{ fontSize: 13, color: "#888", marginBottom: 16, fontWeight: 500 }}>Cine a cheltuit — {LUNI[lunaSelectata]} {anSelectat}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
                    {PERSOANE.map(p => procentePersoane[p] > 0 && (
                      <div key={p}><BaraProcentaj label={p} procent={procentePersoane[p]} culoare={CULORI_PERSOANE[p]} /></div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="card">
                  <div style={{ fontSize: 13, color: "#888", marginBottom: 16, fontWeight: 500 }}>Cheltuieli pe categorii</div>
                  {dataPie.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={dataPie} cx="50%" cy="50%" innerRadius={52} outerRadius={82} dataKey="value" paddingAngle={3}>
                          {dataPie.map((_, i) => <Cell key={i} fill={CULORI_CHELTUIELI[i % CULORI_CHELTUIELI.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => formatRon(v)} contentStyle={{ background: "#fff", border: "1px solid #ddd", borderRadius: 8, color: "#111", fontSize: 13 }} />
                        <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 13 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div style={{ color: "#555", fontSize: 13, textAlign: "center", paddingTop: 60 }}>Nicio cheltuială în {LUNI[lunaSelectata]}</div>}
                </div>

                <div className="card">
                  <div style={{ fontSize: 13, color: "#888", marginBottom: 16, fontWeight: 500 }}>Surse de venit</div>
                  {dataVenituri.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={dataVenituri} cx="50%" cy="50%" innerRadius={52} outerRadius={82} dataKey="value" paddingAngle={3}>
                          {dataVenituri.map((_, i) => <Cell key={i} fill={CULORI_VENITURI[i % CULORI_VENITURI.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => formatRon(v)} contentStyle={{ background: "#fff", border: "1px solid #ddd", borderRadius: 8, color: "#111", fontSize: 13 }} />
                        <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 13 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div style={{ color: "#555", fontSize: 13, textAlign: "center", paddingTop: 60 }}>Niciun venit în {LUNI[lunaSelectata]}</div>}
                </div>
              </div>

              <div className="card">
                <div style={{ fontSize: 13, color: "#888", marginBottom: 16, fontWeight: 500 }}>Evoluție {anSelectat}</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dataBar} barGap={4}>
                    <XAxis dataKey="luna" tick={{ fill: "#888", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#888", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => v > 0 ? `${v/1000}k` : 0} />
                    <Tooltip formatter={(v) => formatRon(v)} contentStyle={{ background: "#fff", border: "1px solid #ddd", borderRadius: 8, color: "#111", fontSize: 13 }} />
                    <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 13 }} />
                    <Bar dataKey="Venituri" fill="#2ecc71" radius={[4,4,0,0]} />
                    <Bar dataKey="Cheltuieli" fill="#e05c4a" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* TRANZACTII */}
          {tab === "tranzactii" && (
            <div className="card">
              <div style={{ fontSize: 13, color: "#888", marginBottom: 20, fontWeight: 500 }}>
                {tranzactiiLuna.length} tranzacții în {LUNI[lunaSelectata]} {anSelectat}
              </div>
              {tranzactiiLuna.length === 0 && (
                <div style={{ color: "#555", textAlign: "center", padding: "40px 0" }}>Nicio tranzacție în această lună</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[...tranzactiiLuna].sort((a,b) => b.id - a.id).map(t => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: "#12141c", borderRadius: 10, border: "1px solid #2a2d3a" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: t.tip === "venit" ? "#1a3a2a" : "#3a1a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                      {t.tip === "venit" ? "↑" : "↓"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3 }}>{t.descriere || t.categorie}</div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span className={`badge badge-${t.tip === "venit" ? "venit" : "cheltuiala"}`}>{t.categorie}</span>
                        <span style={{ fontSize: 12, color: CULORI_PERSOANE[t.persoana] || "#888", fontWeight: 500 }}>👤 {t.persoana}</span>
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: t.tip === "venit" ? "#2ecc71" : "#e05c4a", marginRight: 8 }}>
                      {t.tip === "venit" ? "+" : "-"}{formatRon(t.suma)}
                    </div>
                    <button className="btn-delete" onClick={() => stergeTranzactie(t.id)}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ADAUGA */}
          {tab === "adauga" && (
            <div className="card" style={{ maxWidth: 500 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, marginBottom: 6 }}>Tranzacție nouă</div>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 24 }}>
                {LUNI[form.luna]} {form.an} · se va adăuga în luna selectată
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                <button className={`tip-btn ${form.tip === "cheltuiala" ? "activ-cheltuiala" : ""}`} onClick={() => setForm(f => ({ ...f, tip: "cheltuiala", categorie: CATEGORII_CHELTUIELI[0] }))}>↓ Cheltuială</button>
                <button className={`tip-btn ${form.tip === "venit" ? "activ-venit" : ""}`} onClick={() => setForm(f => ({ ...f, tip: "venit", categorie: CATEGORII_VENITURI[0] }))}>↑ Venit</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Sumă (RON)</label>
                  <input className="input-field" type="number" placeholder="ex: 500" value={form.suma} onChange={e => setForm(f => ({ ...f, suma: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Categorie</label>
                  <select className="input-field" value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}>
                    {(form.tip === "venit" ? CATEGORII_VENITURI : CATEGORII_CHELTUIELI).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Descriere (opțional)</label>
                  <input className="input-field" type="text" placeholder="ex: Lidl, benzinărie..." value={form.descriere} onChange={e => setForm(f => ({ ...f, descriere: e.target.value }))} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>An</label>
                    <select className="input-field" value={form.an} onChange={e => setForm(f => ({ ...f, an: Number(e.target.value) }))}>
                      {ANI.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Luna</label>
                    <select className="input-field" value={form.luna} onChange={e => setForm(f => ({ ...f, luna: Number(e.target.value) }))}>
                      {LUNI.map((l, i) => <option key={i} value={i}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Persoană</label>
                    <select className="input-field" value={form.persoana} onChange={e => setForm(f => ({ ...f, persoana: e.target.value }))}>
                      {PERSOANE.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <button className="btn-add" style={{ marginTop: 8, width: "100%", padding: 14, fontSize: 15, background: success ? "#2ecc71" : "#4a90d9", transition: "background 0.3s" }} onClick={adaugaTranzactie}>
                    {success ? "✓ Adăugat!" : "Adaugă tranzacția"}
                  </button>
                  {success && (
                    <div style={{ marginTop: 12, background: "#1a3a2a", border: "1px solid #2ecc71", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18 }}>✅</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#2ecc71" }}>Tranzacție adăugată!</div>
                        <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{LUNI[form.luna]} {form.an} · {form.categorie}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>}
      </div>
    </div>
  );
}
