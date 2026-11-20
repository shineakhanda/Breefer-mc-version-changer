const React = window.React;
if (!React) throw new Error('window.React is not available for extension module rendering.');

import { Alert, Badge, Button, Card, Check, Empty, Input, Loading, Modal, Page, api, getServerId, timeAgo, toastErr, toastOk } from './breefer-ui.js';
const { useState, useEffect, useMemo } = React;
const base = () => `/api/client/extensions/breefer-version-changer/servers/${getServerId()}`;
const buildLabel = (b) => (b.buildNumber === 1 && b.projectVersionId ? b.projectVersionId : `#${b.buildNumber}`);
export default function VersionPage() {
    const [types, setTypes] = useState(null);
    const [installed, setInstalled] = useState(null);
    const [error, setError] = useState(null);
    const [type, setType] = useState(null);
    const [versions, setVersions] = useState(null);
    const [version, setVersion] = useState(null);
    const [builds, setBuilds] = useState(null);
    const [filter, setFilter] = useState('');
    const [snapshots, setSnapshots] = useState(false);
    const [target, setTarget] = useState(null);
    const [wipe, setWipe] = useState(false);
    const [eula, setEula] = useState(true);
    const [installing, setInstalling] = useState(false);
    useEffect(() => {
        api('GET', base() + '/types')
            .then((d) => setTypes(d.types))
            .catch((e) => setError(e.message));
        api('GET', base() + '/installed')
            .then((d) => setInstalled(d.installed))
            .catch(() => null);
    }, []);
    const pickType = (t) => {
        setType(t);
        setVersion(null);
        setBuilds(null);
        setVersions(null);
        setFilter('');
        api('GET', `${base()}/types/${t.key}`)
            .then((d) => setVersions(d.versions))
            .catch((e) => toastErr(e.message));
    };
    const pickVersion = (v) => {
        setVersion(v);
        setBuilds(null);
        api('GET', `${base()}/types/${type.key}/${encodeURIComponent(v.version)}`)
            .then((d) => setBuilds(d.builds))
            .catch((e) => toastErr(e.message));
    };
    const shown = useMemo(() => {
        if (!versions)
            return [];
        const q = filter.trim().toLowerCase();
        return versions.filter((v) => (snapshots || v.type !== 'SNAPSHOT') && (!q || v.version.toLowerCase().includes(q)));
    }, [versions, filter, snapshots]);
    const install = async () => {
        if (!target)
            return;
        setInstalling(true);
        try {
            const r = await api('POST', base() + '/install', { build: target.build.id, delete_files: wipe, accept_eula: eula }, 15 * 60 * 1000);
            setInstalled(r.installed);
            toastOk(`Installed ${type?.name} ${target.version.version}. You can start the server now.`);
            setTarget(null);
        }
        catch (e) {
            toastErr(e.message);
        }
        finally {
            setInstalling(false);
        }
    };
    return (React.createElement(Page, { title: 'Version Changer', subtitle: 'Install any Minecraft server software and version in one click.', letter: 'V', actions: installed ? React.createElement(Badge, { kind: 'ok' }, `Installed: ${installed.type} ${installed.version} ${installed.build ? '#' + installed.build : ''}`) : null },
        error ? React.createElement(Alert, { kind: 'err' }, error) : null,
        !types && !error ? React.createElement(Loading, null) : null,
        types ? (React.createElement(Card, { title: '1. Server software' },
            React.createElement("div", { className: 'brf-grid', style: { ['--brf-min']: '200px' } }, types.map((t) => (React.createElement("div", { key: t.key, className: 'brf-item brf-click', style: type?.key === t.key ? { borderColor: 'var(--brf-pri)' } : undefined, onClick: () => pickType(t), title: t.description },
                t.icon ? React.createElement("img", { className: 'brf-thumb', src: t.icon, alt: '', style: { width: 36, height: 36 } }) : null,
                React.createElement("div", { className: 'brf-grow' },
                    React.createElement("p", { className: 'brf-title' }, t.name),
                    React.createElement("span", { className: 'brf-muted' },
                        t.experimental ? 'Experimental · ' : '',
                        t.builds,
                        " builds")))))))) : null,
        type ? (React.createElement("div", { className: 'brf-grid', style: { ['--brf-min']: '320px', marginTop: 14 } },
            React.createElement(Card, { title: `2. ${type.name} version` },
                React.createElement("div", { className: 'brf-row', style: { marginBottom: 10 } },
                    React.createElement(Input, { className: 'brf-grow', style: { flex: 1 }, placeholder: 'Filter versions\u2026', value: filter, onValue: setFilter }),
                    React.createElement(Check, { checked: snapshots, onValue: setSnapshots, label: 'Snapshots' })),
                !versions ? (React.createElement(Loading, null)) : shown.length === 0 ? (React.createElement(Empty, { title: 'No versions' })) : (React.createElement("div", { className: 'brf-list', style: { maxHeight: 420, overflowY: 'auto' } }, shown.map((v) => (React.createElement("div", { key: v.version, className: 'brf-item brf-click', style: version?.version === v.version ? { borderColor: 'var(--brf-pri)', padding: '8px 12px' } : { padding: '8px 12px' }, onClick: () => pickVersion(v) },
                    React.createElement("div", { className: 'brf-grow' },
                        React.createElement("p", { className: 'brf-title' }, v.version),
                        React.createElement("span", { className: 'brf-muted' },
                            v.builds,
                            " build",
                            v.builds === 1 ? '' : 's',
                            v.java ? ` · Java ${v.java}` : '')),
                    v.type === 'SNAPSHOT' ? React.createElement(Badge, { kind: 'warn' }, "snapshot") : null,
                    !v.supported ? React.createElement(Badge, null, "legacy") : null,
                    v.latest ? (React.createElement(Button, { size: 'sm', onClick: (e) => {
                            e.stopPropagation();
                            setTarget({ build: v.latest, version: v });
                        } }, "Install latest")) : null)))))),
            React.createElement(Card, { title: '3. Build' }, !version ? (React.createElement(Empty, { title: 'Pick a version', text: 'Select a version on the left to see its builds.' })) : !builds ? (React.createElement(Loading, null)) : builds.length === 0 ? (React.createElement(Empty, { title: 'No builds found' })) : (React.createElement("div", { className: 'brf-list', style: { maxHeight: 420, overflowY: 'auto' } }, builds.map((b, i) => (React.createElement("div", { key: b.id, className: 'brf-item', style: { padding: '8px 12px' } },
                React.createElement("div", { className: 'brf-grow' },
                    React.createElement("p", { className: 'brf-title' },
                        buildLabel(b),
                        " ",
                        i === 0 ? React.createElement(Badge, { kind: 'pri' }, "latest") : null,
                        " ",
                        b.experimental ? React.createElement(Badge, { kind: 'warn' }, "experimental") : null),
                    React.createElement("span", { className: 'brf-muted' }, timeAgo(b.created))),
                React.createElement(Button, { size: 'sm', variant: i === 0 ? 'primary' : 'sec', onClick: () => setTarget({ build: b, version }) }, "Install"))))))))) : null,
        React.createElement(Modal, { open: !!target, onClose: () => !installing && setTarget(null), title: 'Install server software' }, target ? (React.createElement("div", { className: 'brf-col' },
            React.createElement("p", { style: { margin: 0 } },
                "Install ",
                React.createElement("b", null, type?.name),
                " ",
                target.version.version,
                " build ",
                React.createElement("b", null, buildLabel(target.build)),
                "?",
                target.version.java ? ` Requires Java ${target.version.java}.` : ''),
            React.createElement(Alert, { kind: 'warn', style: { marginBottom: 0 } },
                "The server will be stopped. Old ",
                React.createElement("code", null, "server.jar"),
                " and ",
                React.createElement("code", null, "libraries/"),
                " are replaced. Always keep a backup before switching software."),
            React.createElement(Check, { checked: wipe, onValue: setWipe, label: 'Delete ALL server files first (worlds, configs, plugins)' }),
            React.createElement(Check, { checked: eula, onValue: setEula, label: 'I accept the Minecraft EULA (writes eula=true)' }),
            React.createElement("div", { className: 'brf-row brf-end' },
                React.createElement(Button, { variant: 'sec', disabled: installing, onClick: () => setTarget(null) }, "Cancel"),
                React.createElement(Button, { variant: wipe ? 'danger' : 'primary', loading: installing, onClick: install }, installing ? 'Installing…' : 'Install')))) : null)));
}
