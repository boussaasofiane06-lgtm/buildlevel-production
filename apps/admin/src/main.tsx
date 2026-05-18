import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Integration = {
  id: string;
  label: string;
  status: "ready" | "needs_configuration";
  configured: boolean;
  environment: Array<{ name: string; configured: boolean }>;
};

type DashboardSnapshot = {
  metrics: Record<string, number>;
  integrations: Integration[];
  updatedAt: string;
};

type Notification = {
  type: string;
  severity: string;
  title: string;
  message: string;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

const sections = [
  "Overview",
  "Shopify",
  "Printify",
  "Stripe",
  "Tidio AI",
  "Products",
  "Inventory",
  "Orders",
  "Customers",
  "Analytics",
  "Content",
  "Settings",
  "Environment",
  "Theme",
  "Notifications",
  "Automations",
];

function apiPath(path: string) {
  return `${API_BASE}${path}`;
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("buildlevel_admin_token") || "");
  const [activeSection, setActiveSection] = useState("Overview");
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [environment, setEnvironment] = useState<Record<string, unknown> | null>(null);
  const [theme, setTheme] = useState({ accent: "#ff7a1a", mode: "cinematic-black", logoText: "BUILD LEVEL" });
  const [automation, setAutomation] = useState({ productSync: "manual", orderAlerts: "enabled", contentPublishing: "manual" });
  const [message, setMessage] = useState("");

  const request = useMemo(() => {
    return async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      const response = await fetch(apiPath(path), {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers || {}),
        },
        credentials: "include",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Request failed: ${response.status}`);
      }
      return response.json();
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      try {
        const [snapshot, notices, env, themeSettings, automationSettings] = await Promise.all([
          request<DashboardSnapshot>("/api/admin/dashboard"),
          request<Notification[]>("/api/admin/notifications"),
          request<Record<string, unknown>>("/api/admin/environment"),
          request<Record<string, string>>("/api/admin/theme"),
          request<Record<string, string>>("/api/admin/automations"),
        ]);
        if (cancelled) return;
        setDashboard(snapshot);
        setNotifications(notices);
        setEnvironment(env);
        setTheme((current) => ({ ...current, ...themeSettings }));
        setAutomation((current) => ({ ...current, ...automationSettings }));
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load dashboard");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [request, token]);

  if (!token) {
    return <LoginScreen onLogin={setToken} />;
  }

  const integrations = dashboard?.integrations || [];
  const activeIntegration = integrations.find((item) => activeSection.toLowerCase().startsWith(item.id));

  async function testIntegration(id: string) {
    const result = await request<{ message: string }>(`/api/admin/integrations/${id}/test`, { method: "POST" });
    setMessage(result.message);
  }

  async function runProductSync(provider: "shopify" | "printify" | "all") {
    const result = await request<{ message: string }>("/api/admin/sync/products", {
      method: "POST",
      body: JSON.stringify({ provider, mode: "dry_run" }),
    });
    setMessage(result.message);
  }

  async function saveTheme(event: FormEvent) {
    event.preventDefault();
    await request("/api/admin/theme", { method: "POST", body: JSON.stringify(theme) });
    setMessage("Theme settings saved for the admin ecosystem.");
  }

  async function saveAutomation(event: FormEvent) {
    event.preventDefault();
    await request("/api/admin/automations", { method: "POST", body: JSON.stringify(automation) });
    setMessage("Automation controls saved.");
  }

  function logout() {
    localStorage.removeItem("buildlevel_admin_token");
    setToken("");
  }

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <span>BL</span>
          <div>
            <strong>Build Level</strong>
            <small>Admin Command</small>
          </div>
        </div>
        <nav>
          {sections.map((section) => (
            <button key={section} className={activeSection === section ? "active" : ""} onClick={() => setActiveSection(section)}>
              {section}
            </button>
          ))}
        </nav>
        <button className="ghost-button" onClick={logout}>Logout</button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Protected admin-only architecture</p>
            <h1>{activeSection}</h1>
          </div>
          <div className="status-pill">
            <span />
            Secure session
          </div>
        </header>

        {message && <div className="message">{message}</div>}

        {activeSection === "Overview" && dashboard && (
          <>
            <section className="metric-grid">
              {Object.entries(dashboard.metrics).map(([label, value]) => (
                <article className="metric-card" key={label}>
                  <small>{label.replace(/([A-Z])/g, " $1")}</small>
                  <strong>{value}</strong>
                </article>
              ))}
            </section>
            <section className="panel-grid">
              <IntegrationMatrix integrations={integrations} onTest={testIntegration} />
              <NotificationsPanel notifications={notifications} />
            </section>
          </>
        )}

        {activeIntegration && (
          <section className="glass-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Integration management</p>
                <h2>{activeIntegration.label}</h2>
              </div>
              <span className={`status ${activeIntegration.status}`}>{activeIntegration.status.replace("_", " ")}</span>
            </div>
            <div className="env-grid">
              {activeIntegration.environment.map((item) => (
                <div className="env-item" key={item.name}>
                  <span>{item.name}</span>
                  <strong>{item.configured ? "Configured" : "Missing"}</strong>
                </div>
              ))}
            </div>
            <div className="action-row">
              <button onClick={() => testIntegration(activeIntegration.id)}>Test configuration</button>
              {(activeIntegration.id === "shopify" || activeIntegration.id === "printify") && (
                <button onClick={() => runProductSync(activeIntegration.id as "shopify" | "printify")}>Dry-run product sync</button>
              )}
            </div>
          </section>
        )}

        {["Products", "Inventory", "Orders", "Customers", "Analytics", "Content", "Settings"].includes(activeSection) && (
          <section className="glass-panel">
            <p className="eyebrow">Admin API surface</p>
            <h2>{activeSection} management</h2>
            <p>
              This admin section is intentionally isolated from the customer storefront. It connects only to protected
              <code> /api/admin/* </code>
              routes and can be extended with focused tables/forms without shipping management code to the public site.
            </p>
            <div className="route-list">
              {routeHints(activeSection).map((route) => <span key={route}>{route}</span>)}
            </div>
          </section>
        )}

        {activeSection === "Environment" && (
          <section className="glass-panel">
            <p className="eyebrow">Safe environment status</p>
            <h2>API and deployment configuration</h2>
            <pre>{JSON.stringify(environment, null, 2)}</pre>
          </section>
        )}

        {activeSection === "Theme" && (
          <form className="glass-panel form-panel" onSubmit={saveTheme}>
            <p className="eyebrow">Brand controls</p>
            <h2>Theme and branding</h2>
            <label>Accent color<input value={theme.accent} onChange={(event) => setTheme({ ...theme, accent: event.target.value })} /></label>
            <label>Mode<input value={theme.mode} onChange={(event) => setTheme({ ...theme, mode: event.target.value })} /></label>
            <label>Logo text<input value={theme.logoText} onChange={(event) => setTheme({ ...theme, logoText: event.target.value })} /></label>
            <button type="submit">Save theme</button>
          </form>
        )}

        {activeSection === "Notifications" && <NotificationsPanel notifications={notifications} />}

        {activeSection === "Automations" && (
          <form className="glass-panel form-panel" onSubmit={saveAutomation}>
            <p className="eyebrow">Automation controls</p>
            <h2>Operational automations</h2>
            <label>Product sync<input value={automation.productSync} onChange={(event) => setAutomation({ ...automation, productSync: event.target.value })} /></label>
            <label>Order alerts<input value={automation.orderAlerts} onChange={(event) => setAutomation({ ...automation, orderAlerts: event.target.value })} /></label>
            <label>Content publishing<input value={automation.contentPublishing} onChange={(event) => setAutomation({ ...automation, contentPublishing: event.target.value })} /></label>
            <button type="submit">Save automations</button>
          </form>
        )}
      </main>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch(apiPath("/api/admin/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Login failed");
      localStorage.setItem("buildlevel_admin_token", body.token);
      onLogin(body.token);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed");
    }
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <p className="eyebrow">Build Level protected command center</p>
        <h1>Admin access</h1>
        <p>Management tools, integrations, analytics, and automation are isolated from the customer storefront.</p>
        <input type="password" placeholder="Admin password" value={password} onChange={(event) => setPassword(event.target.value)} />
        {error && <div className="error">{error}</div>}
        <button type="submit">Enter dashboard</button>
      </form>
    </main>
  );
}

function IntegrationMatrix({ integrations, onTest }: { integrations: Integration[]; onTest: (id: string) => void }) {
  return (
    <section className="glass-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Ecosystem</p>
          <h2>Integrations</h2>
        </div>
      </div>
      <div className="integration-list">
        {integrations.map((integration) => (
          <article key={integration.id}>
            <strong>{integration.label}</strong>
            <span className={`status ${integration.status}`}>{integration.status.replace("_", " ")}</span>
            <button onClick={() => onTest(integration.id)}>Check</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function NotificationsPanel({ notifications }: { notifications: Notification[] }) {
  return (
    <section className="glass-panel">
      <p className="eyebrow">Dashboard notifications</p>
      <h2>Signals</h2>
      <div className="notification-list">
        {(notifications.length ? notifications : [{ type: "system", severity: "success", title: "No urgent signals", message: "The admin ecosystem has no generated alerts." }]).map((item) => (
          <article key={`${item.type}-${item.title}`}>
            <strong>{item.title}</strong>
            <p>{item.message}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function routeHints(section: string) {
  const map: Record<string, string[]> = {
    Products: ["/api/admin/products", "/api/admin/affiliate", "/api/admin/memberships", "/api/admin/digital"],
    Inventory: ["/api/admin/inventory", "/api/admin/sync/products"],
    Orders: ["/api/admin/orders"],
    Customers: ["/api/admin/customers"],
    Analytics: ["/api/admin/analytics/overview"],
    Content: ["/api/admin/blog", "/api/admin/settings"],
    Settings: ["/api/admin/settings", "/api/admin/theme", "/api/admin/environment"],
  };
  return map[section] || ["/api/admin/dashboard"];
}

createRoot(document.getElementById("root")!).render(<App />);
