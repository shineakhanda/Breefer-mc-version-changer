import React from 'react';
import { Alert, Badge, Button, Card, Check, Empty, Input, Loading, Modal, Page, api, getServerId, timeAgo, toastErr, toastOk } from './breefer-ui.js';

const { useState, useEffect, useMemo } = React;

interface SoftwareType {
    key: string;
    name: string;
    icon: string | null;
    description: string;
    experimental: boolean;
    deprecated: boolean;
    builds: number;
}
interface Build {
    id: number;
    type: string;
    versionId: string | null;
    projectVersionId: string | null;
    buildNumber: number;
    experimental: boolean;
    created: string | null;
}
interface VersionRow {
    version: string;
    type: string;
    supported: boolean;
    java: number | null;
    builds: number;
    created: string | null;
    latest: Build | null;
}
interface Installed {
    type: string;
    version: string;
    build: number;
    java: number | null;
    installed_at: string;
}

const base = () => `/api/client/extensions/breefer-version-changer/servers/${getServerId()}`;

const buildLabel = (b: Build) => (b.buildNumber === 1 && b.projectVersionId ? b.projectVersionId : `#${b.buildNumber}`);

export default function VersionPage() {
    const [types, setTypes] = useState<SoftwareType[] | null>(null);
    const [installed, setInstalled] = useState<Installed | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [type, setType] = useState<SoftwareType | null>(null);
    const [versions, setVersions] = useState<VersionRow[] | null>(null);
    const [version, setVersion] = useState<VersionRow | null>(null);
    const [builds, setBuilds] = useState<Build[] | null>(null);
    const [filter, setFilter] = useState('');
    const [snapshots, setSnapshots] = useState(false);
    const [target, setTarget] = useState<{ build: Build; version: VersionRow } | null>(null);
    const [wipe, setWipe] = useState(false);
    const [eula, setEula] = useState(true);
    const [installing, setInstalling] = useState(false);

    useEffect(() => {
        api('GET', base() + '/types')
            .then((d: any) => setTypes(d.types))
            .catch((e) => setError(e.message));
        api('GET', base() + '/installed')
            .then((d: any) => setInstalled(d.installed))
            .catch(() => null);
    }, []);

    const pickType = (t: SoftwareType) => {
        setType(t);
        setVersion(null);
        setBuilds(null);
        setVersions(null);
        setFilter('');
        api('GET', `${base()}/types/${t.key}`)
            .then((d: any) => setVersions(d.versions))
            .catch((e) => toastErr(e.message));
    };

    const pickVersion = (v: VersionRow) => {
        setVersion(v);
        setBuilds(null);
        api('GET', `${base()}/types/${type!.key}/${encodeURIComponent(v.version)}`)
            .then((d: any) => setBuilds(d.builds))
            .catch((e) => toastErr(e.message));
    };

    const shown = useMemo(() => {
        if (!versions) return [];
        const q = filter.trim().toLowerCase();
        return versions.filter((v) => (snapshots || v.type !== 'SNAPSHOT') && (!q || v.version.toLowerCase().includes(q)));
    }, [versions, filter, snapshots]);

    const install = async () => {
        if (!target) return;
        setInstalling(true);
        try {
            const r: any = await api('POST', base() + '/install', { build: target.build.id, delete_files: wipe, accept_eula: eula }, 15 * 60 * 1000);
            setInstalled(r.installed);
            toastOk(`Installed ${type?.name} ${target.version.version}. You can start the server now.`);
            setTarget(null);
        } catch (e: any) {
            toastErr(e.message);
        } finally {
            setInstalling(false);
        }
    };

    return (
        <Page
            title='Version Changer'
            subtitle='Install any Minecraft server software and version in one click.'
            letter='V'
            actions={installed ? <Badge kind='ok'>{`Installed: ${installed.type} ${installed.version} ${installed.build ? '#' + installed.build : ''}`}</Badge> : null}
        >
            {error ? <Alert kind='err'>{error}</Alert> : null}
            {!types && !error ? <Loading /> : null}

            {types ? (
                <Card title='1. Server software'>
                    <div className='brf-grid' style={{ ['--brf-min' as any]: '200px' }}>
                        {types.map((t) => (
                            <div
                                key={t.key}
                                className='brf-item brf-click'
                                style={type?.key === t.key ? { borderColor: 'var(--brf-pri)' } : undefined}
                                onClick={() => pickType(t)}
                                title={t.description}
                            >
                                {t.icon ? <img className='brf-thumb' src={t.icon} alt='' style={{ width: 36, height: 36 }} /> : null}
                                <div className='brf-grow'>
                                    <p className='brf-title'>{t.name}</p>
                                    <span className='brf-muted'>
                                        {t.experimental ? 'Experimental · ' : ''}
                                        {t.builds} builds
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            ) : null}

            {type ? (
                <div className='brf-grid' style={{ ['--brf-min' as any]: '320px', marginTop: 14 }}>
                    <Card title={`2. ${type.name} version`}>
                        <div className='brf-row' style={{ marginBottom: 10 }}>
                            <Input className='brf-grow' style={{ flex: 1 }} placeholder='Filter versions…' value={filter} onValue={setFilter} />
                            <Check checked={snapshots} onValue={setSnapshots} label='Snapshots' />
                        </div>
                        {!versions ? (
                            <Loading />
                        ) : shown.length === 0 ? (
                            <Empty title='No versions' />
                        ) : (
                            <div className='brf-list' style={{ maxHeight: 420, overflowY: 'auto' }}>
                                {shown.map((v) => (
                                    <div
                                        key={v.version}
                                        className='brf-item brf-click'
                                        style={version?.version === v.version ? { borderColor: 'var(--brf-pri)', padding: '8px 12px' } : { padding: '8px 12px' }}
                                        onClick={() => pickVersion(v)}
                                    >
                                        <div className='brf-grow'>
                                            <p className='brf-title'>{v.version}</p>
                                            <span className='brf-muted'>
                                                {v.builds} build{v.builds === 1 ? '' : 's'}
                                                {v.java ? ` · Java ${v.java}` : ''}
                                            </span>
                                        </div>
                                        {v.type === 'SNAPSHOT' ? <Badge kind='warn'>snapshot</Badge> : null}
                                        {!v.supported ? <Badge>legacy</Badge> : null}
                                        {v.latest ? (
                                            <Button
                                                size='sm'
                                                onClick={(e: any) => {
                                                    e.stopPropagation();
                                                    setTarget({ build: v.latest!, version: v });
                                                }}
                                            >
                                                Install latest
                                            </Button>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card title='3. Build'>
                        {!version ? (
                            <Empty title='Pick a version' text='Select a version on the left to see its builds.' />
                        ) : !builds ? (
                            <Loading />
                        ) : builds.length === 0 ? (
                            <Empty title='No builds found' />
                        ) : (
                            <div className='brf-list' style={{ maxHeight: 420, overflowY: 'auto' }}>
                                {builds.map((b, i) => (
                                    <div key={b.id} className='brf-item' style={{ padding: '8px 12px' }}>
                                        <div className='brf-grow'>
                                            <p className='brf-title'>
                                                {buildLabel(b)} {i === 0 ? <Badge kind='pri'>latest</Badge> : null} {b.experimental ? <Badge kind='warn'>experimental</Badge> : null}
                                            </p>
                                            <span className='brf-muted'>{timeAgo(b.created)}</span>
                                        </div>
                                        <Button size='sm' variant={i === 0 ? 'primary' : 'sec'} onClick={() => setTarget({ build: b, version })}>
                                            Install
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            ) : null}

            <Modal open={!!target} onClose={() => !installing && setTarget(null)} title='Install server software'>
                {target ? (
                    <div className='brf-col'>
                        <p style={{ margin: 0 }}>
                            Install <b>{type?.name}</b> {target.version.version} build <b>{buildLabel(target.build)}</b>?
                            {target.version.java ? ` Requires Java ${target.version.java}.` : ''}
                        </p>
                        <Alert kind='warn' style={{ marginBottom: 0 }}>
                            The server will be stopped. Old <code>server.jar</code> and <code>libraries/</code> are replaced. Always keep a backup before switching software.
                        </Alert>
                        <Check checked={wipe} onValue={setWipe} label='Delete ALL server files first (worlds, configs, plugins)' />
                        <Check checked={eula} onValue={setEula} label='I accept the Minecraft EULA (writes eula=true)' />
                        <div className='brf-row brf-end'>
                            <Button variant='sec' disabled={installing} onClick={() => setTarget(null)}>
                                Cancel
                            </Button>
                            <Button variant={wipe ? 'danger' : 'primary'} loading={installing} onClick={install}>
                                {installing ? 'Installing…' : 'Install'}
                            </Button>
                        </div>
                    </div>
                ) : null}
            </Modal>
        </Page>
    );
}
