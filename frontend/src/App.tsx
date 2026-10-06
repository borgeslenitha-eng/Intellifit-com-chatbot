import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";
type Food = {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  storageLocation: string;
  expirationDate: string | null;
};
type Message = { role: "user" | "assistant"; content: string };
type Session = { token: string; user: { name: string; email: string } };
const shortcuts = [
  "O que tenho na geladeira?",
  "O que vence nesta semana?",
  "Cadastrar alimento",
  "Usei um alimento",
  "Sugerir receitas",
  "Resumo do estoque",
];
const initial: Omit<Food, "id"> = {
  name: "",
  quantity: 1,
  unit: "un",
  category: "Outros",
  storageLocation: "despensa",
  expirationDate: "",
};
function days(date: string | null) {
  if (!date) return Number.NaN;
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
  return Math.round(
    (Date.parse(date.slice(0, 10) + "T12:00:00Z") -
      Date.parse(today + "T12:00:00Z")) /
      86400000,
  );
}
function status(f: Food) {
  return f.quantity === 0
    ? "Sem saldo"
    : !f.expirationDate
      ? "Sem validade"
      : days(f.expirationDate) < 0
        ? "Vencido"
        : days(f.expirationDate) === 0
          ? "Vence hoje"
          : days(f.expirationDate) <= 7
            ? "Vence em breve"
            : "Em dia";
}
function RichText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\*\*[^*]+\*\*)/g)
        .map((part, i) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={i}>{part.slice(2, -2)}</strong>
          ) : (
            part
          ),
        )}
    </>
  );
}
function readableQuantity(q: number, u: string) {
  if (u === "kg" && q > 0 && q < 1) {
    q *= 1000;
    u = "g";
  }
  if (u === "l" && q > 0 && q < 1) {
    q *= 1000;
    u = "ml";
  }
  return `${Number(q.toFixed(2)).toLocaleString("pt-BR")} ${u}`;
}
function MessageContent({ content }: { content: string }) {
  if (!content.includes("Ideias do catálogo local"))
    return (
      <div className="formatted-message">
        {content.split("\n\n").map((block, i) => (
          <p key={i}>
            <RichText text={block} />
          </p>
        ))}
      </div>
    );
  const blocks = content.split("\n\n");
  return (
    <div className="recipe-message">
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        if (lines.length < 2)
          return (
            <p
              key={index}
              className={index === 0 ? "recipe-intro" : "recipe-footnote"}
            >
              {block}
            </p>
          );
        return (
          <article className="recipe-card" key={index}>
            <h3>{lines[0]}</h3>
            {lines.slice(1).map((line, lineIndex) => {
              const label = line.match(
                /^(Você tem:|Falta comprar:|Preparo:)\s*(.*)$/,
              );
              return (
                <p
                  key={lineIndex}
                  className={
                    line.startsWith("Falta comprar:") ? "recipe-missing" : ""
                  }
                >
                  {label ? (
                    <>
                      <strong>{label[1]}</strong> {label[2]}
                    </>
                  ) : (
                    line
                  )}
                </p>
              );
            })}
          </article>
        );
      })}
    </div>
  );
}
function App() {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem("intellifit-session") || "null");
    } catch {
      return null;
    }
  });
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [auth, setAuth] = useState({ name: "", email: "", password: "" });
  const [foods, setFoods] = useState<Food[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [actions, setActions] = useState(shortcuts);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("Todos");
  const [filter, setFilter] = useState("Todos");
  const [mobile, setMobile] = useState("Estoque");
  const [form, setForm] = useState<Omit<Food, "id">>(initial);
  const [editing, setEditing] = useState<number | null>(null);
  const [modal, setModal] = useState(false);
  const [clearChatOpen, setClearChatOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Food | null>(null);
  const end = useRef<HTMLDivElement>(null);
  async function api(path: string, options: RequestInit = {}) {
    const res = await fetch("/api" + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
        ...options.headers,
      },
    });
    if (res.status === 401 && session) {
      sessionStorage.removeItem("intellifit-session");
      setSession(null);
      throw new Error("Sua sessão expirou. Entre novamente.");
    }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({
      error: "Servidor indisponível. Confira se o backend está rodando.",
    }));
    if (!res.ok) throw new Error(data.error || "Não foi possível concluir.");
    return data;
  }
  async function refresh() {
    const data = await api("/foods");
    setFoods(data);
    setConnected(true);
  }
  useEffect(() => {
    if (!session) return;
    setLoading(true);
    Promise.all([refresh(), api("/chat/history").then(setMessages)])
      .catch((e) => {
        setError(e.message);
        setConnected(false);
      })
      .finally(() => setLoading(false));
  }, [session]);
  useEffect(() => {
    const area = end.current?.parentElement;
    if (area) area.scrollTo({ top: area.scrollHeight, behavior: "smooth" });
  }, [messages, busy, mobile]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(id);
  }, [toast]);
  async function authenticate(e: FormEvent) {
    e.preventDefault();
    setAuthBusy(true);
    setError("");
    try {
      if (authMode === "register")
        await api("/auth/register", {
          method: "POST",
          body: JSON.stringify(auth),
        });
      const s = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify(auth),
      });
      sessionStorage.setItem("intellifit-session", JSON.stringify(s));
      setSession(s);
      setAuth({ name: "", email: "", password: "" });
      setMessages([]);
      setActions(shortcuts);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAuthBusy(false);
    }
  }
  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setDraft("");
    setError("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    try {
      const r = await api("/chat", {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      setMessages((m) => [...m, { role: "assistant", content: r.reply }]);
      setActions(
        r.actions?.length ? r.actions : r.pending ? ["Cancelar"] : shortcuts,
      );
      if (r.changed) {
        await refresh();
        setToast("Estoque atualizado pelo assistente");
      }
    } catch (e) {
      setError((e as Error).message);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Não foi possível receber a resposta. Atualize a conversa antes de reenviar uma confirmação.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/foods" + (editing ? "/" + editing : ""), {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          expirationDate: form.expirationDate || null,
        }),
      });
      await refresh();
      setModal(false);
      setToast(editing ? "Alimento atualizado" : "Alimento cadastrado");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api("/foods/" + deleteTarget.id, { method: "DELETE" });
      await refresh();
      setDeleteTarget(null);
      setToast("Alimento excluído");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function logout() {
    sessionStorage.removeItem("intellifit-session");
    setSession(null);
    setFoods([]);
    setMessages([]);
    setError("");
    setConnected(false);
  }
  function scrollToLatest() {
    const area = end.current?.parentElement;
    if (area) area.scrollTo({ top: area.scrollHeight, behavior: "smooth" });
  }
  function showOverview() {
    setFilter("Todos");
    setLocation("Todos");
    setSearch("");
    setMobile("Estoque");
  }
  function showRecipes() {
    setMobile("Assistente");
    void send("Sugerir receitas");
  }
  async function clearConversation() {
    setClearing(true);
    setError("");
    try {
      await api("/chat/history", { method: "DELETE" });
      setMessages([]);
      setActions(shortcuts);
      setDraft("");
      setClearChatOpen(false);
      setToast("Conversa apagada. Seus alimentos foram mantidos.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setClearing(false);
    }
  }
  const selected = foods.filter(
    (f) =>
      (location === "Todos" || f.storageLocation.toLowerCase() === location) &&
      (!search ||
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.category.toLowerCase().includes(search.toLowerCase())) &&
      (filter === "Todos" ||
        (filter === "Atenção"
          ? f.quantity > 0 && days(f.expirationDate) <= 7
          : status(f) === filter)),
  );
  const attention = foods.filter(
    (f) => f.quantity > 0 && days(f.expirationDate) <= 7,
  ).length;
  if (!session)
    return (
      <main className="auth-page">
        <section className="auth-story">
          <a className="brand" href="/">
            <span>IntelliFit</span>
          </a>
          <div>
            <span className="eyebrow">
              MENOS DESPERDÍCIO. MAIS POSSIBILIDADES.
            </span>
            <h1>
              Sua cozinha,
              <br />
              em boa companhia.
            </h1>
            <p>
              Organize seus alimentos e descubra o que preparar.
              <br />
              Uma conversa de cada vez.
            </p>
            <div className="illustration">
              <div className="produce" aria-hidden="true" />
              <div className="note">
                Na sua geladeira
                <br />
                <strong>Novas ideias para hoje</strong>
                <span>Estoque + receitas + assistente</span>
              </div>
            </div>
          </div>
          <small>IntelliFit · Assistente de alimentos domésticos</small>
        </section>
        <section className="auth-side">
          <form className="auth-card" onSubmit={authenticate}>
            <span className="eyebrow">BEM-VINDA AO INTELLIFIT</span>
            <h2>
              {authMode === "login"
                ? "Entre na sua cozinha"
                : "Crie seu espaço"}
            </h2>
            <p>Seus alimentos, organizados em um só lugar.</p>
            <div className="segmented">
              <button
                type="button"
                className={authMode === "login" ? "active" : ""}
                onClick={() => {
                  setAuthMode("login");
                  setError("");
                }}
              >
                Entrar
              </button>
              <button
                type="button"
                className={authMode === "register" ? "active" : ""}
                onClick={() => {
                  setAuthMode("register");
                  setError("");
                }}
              >
                Criar conta
              </button>
            </div>
            {authMode === "register" && (
              <label>
                Seu nome
                <input
                  required
                  maxLength={100}
                  autoComplete="name"
                  value={auth.name}
                  onChange={(e) => setAuth({ ...auth, name: e.target.value })}
                />
              </label>
            )}
            <label>
              E-mail
              <input
                type="email"
                required
                autoComplete="email"
                value={auth.email}
                onChange={(e) => setAuth({ ...auth, email: e.target.value })}
                placeholder="voce@exemplo.com"
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                required
                minLength={6}
                autoComplete={
                  authMode === "login" ? "current-password" : "new-password"
                }
                value={auth.password}
                onChange={(e) => setAuth({ ...auth, password: e.target.value })}
                placeholder="Pelo menos 6 caracteres"
              />
            </label>
            {error && (
              <div role="alert" className="error">
                {error}
              </div>
            )}
            <button className="primary wide" disabled={authBusy}>
              {authBusy
                ? "Conectando…"
                : authMode === "login"
                  ? "Entrar →"
                  : "Criar conta e entrar →"}
            </button>
            <p className="auth-foot">
              Cada conta tem seu próprio estoque e histórico de conversa.
            </p>
          </form>
        </section>
      </main>
    );
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span>IntelliFit</span>
        </a>
        <p className="nav-label">MINHA COZINHA</p>
        <button
          className={"nav " + (filter !== "Atenção" ? "active" : "")}
          aria-current={filter !== "Atenção" ? "page" : undefined}
          title="Visão geral"
          onClick={showOverview}
        >
          ▦ <span>Visão geral</span>
        </button>
        <button
          className={
            "nav " + (filter === "Atenção" ? "active validity-active" : "")
          }
          aria-current={filter === "Atenção" ? "page" : undefined}
          title="Validades"
          onClick={() => {
            setLocation("Todos");
            setSearch("");
            setFilter("Atenção");
            setMobile("Estoque");
          }}
        >
          ◷ <span>Validades</span>
          <b>{attention}</b>
        </button>
        <button
          className="nav"
          title="Ideias de receitas"
          disabled={busy || clearing}
          onClick={showRecipes}
        >
          ♧ <span>Ideias de receitas</span>
        </button>
        <div className="sidebar-bottom">
          <div className="tip">
            <span>UM PEQUENO HÁBITO</span>
            <p>
              Usou um alimento?
              <br />
              Conte ao assistente e mantenha o estoque em dia.
            </p>
          </div>
          <div className="profile">
            <span className="avatar">
              {session.user.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{session.user.name}</strong>
              <button onClick={logout}>Sair da conta</button>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Minha cozinha{" "}
            <b>/ {filter === "Atenção" ? "Validades" : "Visão geral"}</b>
          </span>
          <span className={"connection " + (!connected ? "offline" : "")}>
            ● {connected ? "Conectado ao banco" : "Conectando…"}
          </span>
        </header>
        <div className="mobile-tabs">
          {["Estoque", "Assistente"].map((t) => (
            <button
              className={mobile === t ? "active" : ""}
              key={t}
              onClick={() => setMobile(t)}
            >
              {t}
            </button>
          ))}
        </div>
        {error && (
          <div role="alert" className="error global-error">
            {error}
            <button aria-label="Fechar aviso" onClick={() => setError("")}>
              ×
            </button>
          </div>
        )}
        <main className="dashboard">
          <section
            className={
              "inventory " + (mobile === "Assistente" ? "mobile-hide" : "")
            }
          >
            <div className="title-row">
              <div>
                <span className="eyebrow">TUDO NO SEU LUGAR</span>
                <h1>
                  Sua cozinha, em dia<span>.</span>
                </h1>
                <p>Cuide do que você tem. Aproveite cada ingrediente.</p>
              </div>
              <button
                className="primary"
                onClick={() => {
                  setEditing(null);
                  setForm(initial);
                  setModal(true);
                }}
              >
                + Novo alimento
              </button>
            </div>
            <div className="stats">
              <article>
                <span>Alimentos cadastrados</span>
                <strong>{foods.length.toString().padStart(2, "0")}</strong>
                <small>em todos os locais</small>
              </article>
              <article className="warm">
                <span>Precisam de atenção</span>
                <strong>{attention.toString().padStart(2, "0")}</strong>
                <small>vencidos ou em até 7 dias</small>
              </article>
              <article>
                <span>Disponíveis para usar</span>
                <strong>
                  {foods
                    .filter(
                      (f) => f.quantity > 0 && days(f.expirationDate) >= 0,
                    )
                    .length.toString()
                    .padStart(2, "0")}
                </strong>
                <small>com saldo e dentro da validade</small>
              </article>
            </div>
            <div className="stock-card">
              <div className="stock-heading">
                <h2>
                  {filter === "Atenção"
                    ? "Atenção às validades"
                    : "Meu estoque"}{" "}
                  <span>{selected.length}</span>
                </h2>
                <button
                  className="text-button"
                  disabled={loading}
                  onClick={() => {
                    setLoading(true);
                    refresh()
                      .catch((e) => setError(e.message))
                      .finally(() => setLoading(false));
                  }}
                >
                  ↻ Atualizar
                </button>
              </div>
              <div className="locations">
                {["Todos", "geladeira", "despensa", "freezer"].map((l) => (
                  <button
                    key={l}
                    className={location === l ? "active" : ""}
                    aria-pressed={location === l}
                    onClick={() => setLocation(l)}
                  >
                    {l === "Todos"
                      ? "Todos os locais"
                      : l.charAt(0).toUpperCase() + l.slice(1)}
                  </button>
                ))}
              </div>
              <div className="filters">
                <input
                  aria-label="Buscar alimento"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="⌕  Buscar alimento ou categoria"
                />
                <label
                  className={
                    "status-filter " + (filter !== "Todos" ? "is-filtered" : "")
                  }
                >
                  <span>
                    Situação {filter !== "Todos" && <b>Filtro ativo</b>}
                  </span>
                  <select
                    aria-label="Filtrar situação"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    {[
                      "Todos",
                      "Atenção",
                      "Em dia",
                      "Vencido",
                      "Sem saldo",
                      "Sem validade",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
              </div>
              {(filter !== "Todos" || location !== "Todos" || search) && (
                <div
                  className={
                    "filter-summary " +
                    (filter === "Atenção" ? "attention-summary" : "")
                  }
                  role="status"
                >
                  <div>
                    <strong>
                      {filter === "Atenção"
                        ? "Vencidos ou com validade em até 7 dias"
                        : "Exibindo resultados filtrados"}
                    </strong>
                    <span>
                      {filter !== "Todos"
                        ? `Situação: ${filter}`
                        : "Todas as situações"}{" "}
                      · {location === "Todos" ? "Todos os locais" : location}
                      {search ? ` · Busca: ${search}` : ""}
                    </span>
                  </div>
                  <button onClick={showOverview}>Limpar filtros</button>
                </div>
              )}
              {loading ? (
                <div className="empty">Carregando seu estoque…</div>
              ) : selected.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Alimento</th>
                        <th>Quantidade</th>
                        <th>Validade</th>
                        <th aria-label="Ações"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.map((f) => (
                        <tr key={f.id}>
                          <td>
                            <div className="food-cell">
                              <span className="food-icon">
                                {f.storageLocation === "freezer"
                                  ? "❄"
                                  : f.storageLocation === "geladeira"
                                    ? "◈"
                                    : "◒"}
                              </span>
                              <div>
                                <strong>{f.name}</strong>
                                <small>
                                  {f.storageLocation} · Cadastro {f.id}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td>{readableQuantity(f.quantity, f.unit)}</td>
                          <td>
                            <span>
                              {f.expirationDate
                                ? f.expirationDate
                                    .slice(0, 10)
                                    .split("-")
                                    .reverse()
                                    .join("/")
                                : "Não informada"}
                            </span>
                            <small
                              className={
                                "badge " +
                                (f.quantity === 0 || !f.expirationDate
                                  ? "neutral"
                                  : days(f.expirationDate) < 0
                                    ? "red"
                                    : days(f.expirationDate) <= 7
                                      ? "amber"
                                      : "green")
                              }
                            >
                              {status(f)}
                            </small>
                          </td>
                          <td>
                            <div className="row-actions">
                              <button
                                aria-label={"Editar " + f.name}
                                title="Editar"
                                onClick={() => {
                                  setEditing(f.id);
                                  setForm({
                                    ...f,
                                    expirationDate:
                                      f.expirationDate?.slice(0, 10) ?? "",
                                  });
                                  setModal(true);
                                }}
                              >
                                ✎
                              </button>
                              <button
                                aria-label={"Excluir " + f.name}
                                title="Excluir"
                                onClick={() => setDeleteTarget(f)}
                              >
                                ×
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty">
                  <span>◒</span>
                  <h3>
                    {foods.length
                      ? "Nenhum resultado por aqui"
                      : "Sua cozinha começa aqui"}
                  </h3>
                  <p>
                    {foods.length
                      ? "Experimente outro filtro ou termo de busca."
                      : "Cadastre o primeiro alimento pelo botão acima ou converse com o assistente."}
                  </p>
                </div>
              )}
              <div className="table-footer">
                {selected.length} de {foods.length} alimentos{" "}
                <span>Dados da sua conta</span>
              </div>
            </div>
            <button
              className="bottom-note"
              onClick={showRecipes}
              disabled={busy || clearing}
              aria-label="Pedir ideias de receitas ao assistente"
            >
              <span>✦</span>
              <p>
                <strong>Uma ideia para a próxima refeição?</strong> Peça ao
                assistente uma receita com o que já está no estoque.
              </p>
              <span className="note-arrow" aria-hidden="true">
                →
              </span>
            </button>
          </section>
          <section
            className={
              "chat-card " + (mobile === "Estoque" ? "mobile-hide" : "")
            }
            aria-label="Chatbot"
          >
            <header className="chat-header">
              <span className="bot-avatar">✦</span>
              <div>
                <h2>Assistente IntelliFit</h2>
                <small>Vamos cuidar da sua cozinha?</small>
              </div>
              <div className="chat-header-actions">
                <button
                  aria-label="Ir para a última mensagem"
                  title="Ir para a última mensagem"
                  onClick={scrollToLatest}
                >
                  ↓
                </button>
                <button
                  aria-label="Apagar conversa"
                  title="Apagar conversa"
                  disabled={busy || clearing}
                  onClick={() => {
                    setError("");
                    setClearChatOpen(true);
                  }}
                >
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                  >
                    <path d="M3 11a9 9 0 1 1 2.7 7M3 4v7h7" />
                  </svg>
                </button>
              </div>
            </header>
            <div className="chat-messages" aria-live="polite">
              <div className="chat-date">SEU ASSISTENTE DE COZINHA</div>
              <div className="message assistant">
                <span className="message-author">INTELLIFIT</span>Olá! Posso
                organizar seus alimentos, conferir validades e sugerir receitas.
                O que vamos fazer hoje?
              </div>
              {messages.map((m, i) => (
                <div key={i} className={"message " + m.role}>
                  <span className="message-author">
                    {m.role === "user" ? "VOCÊ" : "INTELLIFIT"}
                  </span>
                  {m.role === "assistant" ? (
                    <MessageContent content={m.content} />
                  ) : (
                    m.content
                  )}
                </div>
              ))}
              {busy && (
                <div className="message assistant typing">
                  Consultando sua cozinha…
                </div>
              )}
              <div ref={end} />
            </div>
            <div className="chat-controls">
              <div className="quick-actions">
                {actions.map((a) => (
                  <button key={a} disabled={busy} onClick={() => void send(a)}>
                    {a}
                  </button>
                ))}
              </div>
              <form
                className="composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(draft);
                }}
              >
                <input
                  aria-label="Mensagem para o assistente"
                  maxLength={2000}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ex.: usei 2 ovos"
                  disabled={busy}
                />
                <button
                  className="primary"
                  aria-label="Enviar mensagem"
                  disabled={busy || !draft.trim()}
                >
                  ↑
                </button>
              </form>
              <p>Sua cozinha organizada, uma conversa de cada vez</p>
            </div>
          </section>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          ✓ {toast}
        </div>
      )}
      {clearChatOpen && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-chat-title"
          >
            <h2 id="clear-chat-title">Apagar a conversa?</h2>
            <p>
              As mensagens e qualquer operação ainda não confirmada serão
              apagadas.{" "}
              <strong>
                Seus alimentos e as alterações já confirmadas serão mantidos.
              </strong>
            </p>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <div className="modal-footer">
              <button
                autoFocus
                disabled={clearing}
                onClick={() => setClearChatOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="danger"
                disabled={clearing}
                onClick={() => void clearConversation()}
              >
                {clearing ? "Apagando…" : "Apagar apenas a conversa"}
              </button>
            </div>
          </div>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={save}>
            <div className="modal-heading">
              <h2>{editing ? "Editar alimento" : "Novo alimento"}</h2>
              <button
                type="button"
                aria-label="Fechar formulário"
                onClick={() => setModal(false)}
              >
                ×
              </button>
            </div>
            <label>
              Nome
              <input
                autoFocus
                required
                maxLength={100}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                Quantidade
                <input
                  type="number"
                  min={editing ? 0 : 0.01}
                  max={99999999.99}
                  step="0.01"
                  required
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Unidade
                <select
                  aria-label="Unidade"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                >
                  {["un", "g", "kg", "ml", "l"].map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>
                Local
                <select
                  aria-label="Local"
                  value={form.storageLocation}
                  onChange={(e) =>
                    setForm({ ...form, storageLocation: e.target.value })
                  }
                >
                  {["despensa", "geladeira", "freezer"].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label>
                Validade (opcional)
                <input
                  type="date"
                  min={new Date().toLocaleDateString("en-CA", {
                    timeZone: "America/Sao_Paulo",
                  })}
                  value={form.expirationDate ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, expirationDate: e.target.value })
                  }
                />
              </label>
            </div>
            {error && (
              <div role="alert" className="error">
                {error}
              </div>
            )}
            <div className="modal-footer">
              <button type="button" onClick={() => setModal(false)}>
                Cancelar
              </button>
              <button className="primary" disabled={saving}>
                {saving ? "Salvando…" : "Salvar alimento"}
              </button>
            </div>
          </form>
        </div>
      )}
      {deleteTarget && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Excluir {deleteTarget.name}?</h2>
            <p>O alimento será removido do seu estoque.</p>
            {error && <div className="error">{error}</div>}
            <div className="modal-footer">
              <button onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button
                className="danger"
                onClick={() => void remove()}
                disabled={saving}
              >
                {saving ? "Excluindo…" : "Excluir alimento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
