import { Download, FileCheck, FilePlus2, Printer, Save, Search, Share2, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { blankCase, demoCase, duplicateCase } from './caseFactory';
import { conditionOptions, functionStatusOptions, includedRooms, makeElement, makeKey, makeMeter, makeRoom, presenceStatusOptions, roomHasData, roomNames, visibleElements, withElementDefaults } from './constants';
import { generateInspectionPdf } from './pdf';
import { PhotoInput } from './PhotoInput';
import { deleteCase, downloadDataUrl, downloadText, exportCaseJson, listCases, saveCase } from './storage';
import { SignaturePad } from './SignaturePad';
import type { AccessKey, InspectionCase, InspectionType, Meter, Person, Room, RoomElement } from './types';
import { validateCase } from './validation';

const steps = ['Informations générales', 'Parties', 'Compteurs et clés', 'Pièces', 'Synthèse', 'Signatures', 'PDF'];

function nameOf(person: Person) {
  return `${person.firstName} ${person.lastName}`.trim();
}

function namedPeople(people: Person[]) {
  return people.filter((person) => nameOf(person));
}

export function App() {
  const [cases, setCases] = useState<InspectionCase[]>([]);
  const [current, setCurrent] = useState<InspectionCase | null>(null);
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedAt, setSavedAt] = useState('');
  const readonly = current?.status === 'finalized';

  async function refresh() {
    setCases(await listCases());
  }

  useEffect(() => {
    void refresh();
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  useEffect(() => {
    if (!current || current.status === 'finalized') return;
    const handle = setTimeout(() => {
      setSaveState('saving');
      void saveCase({ ...current, lastStep: step }).then(() => {
        setSavedAt(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
        setSaveState('saved');
        return refresh();
      }).catch(() => setSaveState('error'));
    }, 650);
    return () => clearTimeout(handle);
  }, [current, step]);

  function update(patch: Partial<InspectionCase>) {
    if (!current || readonly) return;
    setCurrent({ ...current, ...patch, updatedAt: new Date().toISOString() });
  }

  function start(type: InspectionType) {
    setCurrent(blankCase(type));
    setStep(0);
  }

  async function finalize() {
    if (!current) return;
    const stamped = { ...current, finalizedAt: new Date().toISOString(), status: 'finalized' as const };
    const result = await generateInspectionPdf(stamped);
    const finalized = { ...stamped, pdfDataUrl: result.dataUrl, pdfHash: result.hash };
    setCurrent(finalized);
    await saveCase(finalized);
    await refresh();
  }

  async function sharePdf() {
    if (!current?.pdfDataUrl) return;
    if ('share' in navigator) await navigator.share({ title: current.title, text: `${current.title} - ${current.address}` }).catch(() => undefined);
    else downloadDataUrl(current.pdfDataUrl, `${current.id}.pdf`);
  }

  const filtered = useMemo(() => cases.filter((item) => `${item.address} ${item.housingType} ${item.tenants.map(nameOf).join(' ')}`.toLowerCase().includes(query.toLowerCase())), [cases, query]);
  const grouped = useMemo(() => {
    const map = new Map<string, InspectionCase[]>();
    filtered.forEach((item) => {
      const key = item.address.trim().toLowerCase() || item.propertyId || item.id;
      map.set(key, [...(map.get(key) || []), item]);
    });
    return [...map.entries()].map(([key, items]) => ({ key, items, latest: items[0] })).sort((a, b) => b.latest.updatedAt.localeCompare(a.latest.updatedAt));
  }, [filtered]);
  const issues = current ? validateCase(current) : [];

  if (!current) {
    return (
      <main className="shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Stockage local sur cet appareil · {online ? 'en ligne' : 'hors connexion'}</p>
            <h1>État des lieux local</h1>
          </div>
          <button className="button secondary" onClick={() => void saveCase(demoCase()).then(refresh)}><Save size={18} /> Charger l’exemple</button>
        </header>
        <section className="homeActions">
          <button className="button primary large" onClick={() => start('entry')}><FilePlus2 /> Nouvel état des lieux d’entrée</button>
          <button className="button primary large" onClick={() => start('exit')}><FilePlus2 /> Nouvel état des lieux de sortie</button>
        </section>
        <label className="search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher par adresse ou locataire" /></label>
        <PropertyList groups={grouped} onOpen={(item) => { setCurrent(item); setStep(item.lastStep ?? 0); }} onDuplicate={(item) => setCurrent(duplicateCase(item, item.type))} onDelete={async (id) => { if (confirm('Supprimer ce brouillon ?')) { await deleteCase(id); await refresh(); } }} />
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar sticky">
        <div>
          <button className="linkButton" onClick={() => {
            const item = current;
            setCurrent(null);
            if (item.status === 'draft') void saveCase(item).then(refresh);
            else void refresh();
          }}>← Accueil</button>
          <h1>{current.title || 'État des lieux'}</h1>
          <p className="eyebrow">{current.id} · version {current.version} · {readonly ? 'finalisé en lecture seule' : saveState === 'saving' ? 'Enregistrement en cours...' : saveState === 'error' ? 'Erreur de sauvegarde - réessayer' : savedAt ? `Enregistré à ${savedAt}` : 'brouillon sauvegardé automatiquement'} · {online ? 'en ligne' : 'hors connexion'}</p>
        </div>
        {!readonly && <button className="button secondary" onClick={() => void saveCase(current).then(refresh)}><Save size={18} /> Enregistrer</button>}
      </header>
      <nav className="steps" aria-label="Étapes">
        {steps.map((label, index) => <button key={label} className={index === step ? 'active' : ''} onClick={() => setStep(index)}><span>{index + 1}</span>{label}</button>)}
      </nav>
      <div className="progress"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
      {step === 0 && <General item={current} update={update} readonly={readonly} />}
      {step === 1 && <Parties item={current} update={update} readonly={readonly} />}
      {step === 2 && <MetersKeys item={current} update={update} readonly={readonly} />}
      {step === 3 && <Rooms item={current} update={update} readonly={readonly} />}
      {step === 4 && <Summary item={current} issues={issues} go={setStep} />}
      {step === 5 && <Signatures item={current} update={update} readonly={readonly} />}
      {step === 6 && <PdfStep item={current} readonly={readonly} finalize={finalize} sharePdf={sharePdf} setCurrent={setCurrent} />}
      <footer className="wizardFooter">
        <button className="button secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Précédent</button>
        <button className="button primary" disabled={step === steps.length - 1} onClick={() => setStep(step + 1)}>Suivant</button>
      </footer>
    </main>
  );
}

function CaseList({ title, items, onOpen, onDuplicate, onDelete }: { title: string; items: InspectionCase[]; onOpen: (item: InspectionCase) => void; onDuplicate: (item: InspectionCase) => void; onDelete?: (id: string) => void }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <div className="caseGrid">
        {items.length === 0 && <p className="hint">Aucun dossier.</p>}
        {items.map((item) => (
          <article className="caseCard" key={item.id}>
            <strong>{item.address || 'Adresse non renseignée'}</strong>
            <span>{item.title} · {namedPeople(item.tenants).map(nameOf).join(', ') || 'Locataire non renseigné'}</span>
            <small>{item.id} · v{item.version}</small>
            <div className="miniActions">
              <button onClick={() => onOpen(item)}>Ouvrir</button>
              <button onClick={() => onDuplicate(item)}>Dupliquer</button>
              {item.pdfDataUrl && <button onClick={() => downloadDataUrl(item.pdfDataUrl!, `${item.id}.pdf`)}>PDF</button>}
              {onDelete && <button onClick={() => onDelete(item.id)}><Trash2 size={16} /></button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PropertyList({ groups, onOpen, onDuplicate, onDelete }: { groups: Array<{ key: string; items: InspectionCase[]; latest: InspectionCase }>; onOpen: (item: InspectionCase) => void; onDuplicate: (item: InspectionCase) => void; onDelete: (id: string) => void }) {
  return (
    <section className="panel">
      <h2>Biens immobiliers</h2>
      <div className="caseGrid">
        {groups.length === 0 && <p className="hint">Aucun bien enregistré.</p>}
        {groups.map(({ key, items, latest }) => {
          const drafts = items.filter((item) => item.status === 'draft');
          const finals = items.filter((item) => item.status === 'finalized');
          const mainDraft = drafts[0];
          return (
            <article className="caseCard" key={key}>
              {latest.mainPhotoDataUrl && <img src={latest.mainPhotoDataUrl} alt="" />}
              <strong>{latest.address || 'Adresse non renseignée'}</strong>
              <span>{latest.housingType} · {latest.surface ? `${latest.surface} m²` : 'surface non renseignée'} · {latest.furnished ? 'meublé' : 'vide'}</span>
              <small>{items.length} dossier(s) · {drafts.length ? 'brouillon en cours' : 'aucun brouillon'} · modifié le {new Date(latest.updatedAt).toLocaleDateString('fr-FR')}</small>
              {mainDraft && <p className="hint">Un brouillon existe pour cette adresse. Vous pouvez le reprendre ou le dupliquer.</p>}
              <div className="miniActions">
                {mainDraft && <button onClick={() => onOpen(mainDraft)}>Reprendre le brouillon</button>}
                <button onClick={() => onOpen(duplicateCase(latest, 'entry'))}>Nouvel état des lieux d’entrée</button>
                <button onClick={() => onOpen(duplicateCase(latest, 'exit'))}>Nouvel état des lieux de sortie</button>
                {finals[0] && <button onClick={() => onOpen(finals[0])}>Voir les documents</button>}
                <button onClick={() => onDuplicate(latest)}>Dupliquer le bien</button>
                {mainDraft && <button onClick={() => onDelete(mainDraft.id)}><Trash2 size={16} /></button>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Field({ label, value, onChange, readonly, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; readonly?: boolean; type?: string }) {
  return <label><span>{label}</span><input disabled={readonly} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function General({ item, update, readonly }: { item: InspectionCase; update: (patch: Partial<InspectionCase>) => void; readonly?: boolean }) {
  const firstPhoto = item.rooms.flatMap((room) => room.photos).find(Boolean);
  return (
    <section className="panel">
      <h2>Informations générales</h2>
      <div className="segmented">
        <button disabled={readonly} className={item.type === 'entry' ? 'active' : ''} onClick={() => update({ type: 'entry', title: 'État des lieux d’entrée' })}>Entrée</button>
        <button disabled={readonly} className={item.type === 'exit' ? 'active' : ''} onClick={() => update({ type: 'exit', title: 'État des lieux de sortie' })}>Sortie</button>
      </div>
      <div className="grid two">
        <Field label="Date" type="date" value={item.date} readonly={readonly} onChange={(date) => update({ date })} />
        <Field label="Heure" type="time" value={item.time} readonly={readonly} onChange={(time) => update({ time })} />
        <Field label="Adresse complète" value={item.address} readonly={readonly} onChange={(address) => update({ address })} />
        <Field label="Bâtiment" value={item.building} readonly={readonly} onChange={(building) => update({ building })} />
        <Field label="Étage" value={item.floor} readonly={readonly} onChange={(floor) => update({ floor })} />
        <Field label="Numéro de porte" value={item.door} readonly={readonly} onChange={(door) => update({ door })} />
        <Field label="Type de logement" value={item.housingType} readonly={readonly} onChange={(housingType) => update({ housingType })} />
        <Field label="Surface habitable" value={item.surface} readonly={readonly} onChange={(surface) => update({ surface })} />
        <Field label="Nombre de pièces" value={item.roomCount} readonly={readonly} onChange={(roomCount) => update({ roomCount })} />
        <Field label="Dépendances éventuelles" value={item.dependencies} readonly={readonly} onChange={(dependencies) => update({ dependencies })} />
        <Field label="Référence facultative du bail" value={item.leaseReference} readonly={readonly} onChange={(leaseReference) => update({ leaseReference })} />
        <Field label="Date de prise d’effet du bail" type="date" value={item.leaseStartDate} readonly={readonly} onChange={(leaseStartDate) => update({ leaseStartDate })} />
      </div>
      <label className="check"><input disabled={readonly} type="checkbox" checked={item.furnished} onChange={(event) => update({ furnished: event.target.checked })} /> Logement meublé</label>
      {firstPhoto && !readonly && <button className="button secondary" onClick={() => update({ mainPhotoDataUrl: firstPhoto.dataUrl })}>Utiliser la première photo comme couverture PDF</button>}
      {item.mainPhotoDataUrl && <p className="hint">Photo principale définie pour la couverture PDF.</p>}
    </section>
  );
}

function Parties({ item, update, readonly }: { item: InspectionCase; update: (patch: Partial<InspectionCase>) => void; readonly?: boolean }) {
  function setTenant(index: number, tenant: Person) {
    update({ tenants: item.tenants.map((value, i) => i === index ? tenant : value), signatures: item.signatures.map((signature) => signature.personId === tenant.id ? { ...signature, name: nameOf(tenant) } : signature) });
  }
  return (
    <section className="panel">
      <h2>Parties</h2>
      <h3>Bailleur</h3>
      <PersonFields person={item.lessor} readonly={readonly} onChange={(lessor) => update({ lessor: lessor as InspectionCase['lessor'], signatures: item.signatures.map((signature) => signature.personId === lessor.id ? { ...signature, name: nameOf(lessor) } : signature) })} address />
      <h3>Locataires</h3>
      {item.tenants.map((tenant, index) => (
        <div className="person" key={tenant.id}>
          <PersonFields person={tenant} readonly={readonly} onChange={(next) => setTenant(index, next)} exit={item.type === 'exit'} />
          {!readonly && !nameOf(tenant) && item.tenants.length > 1 && <button className="button secondary" onClick={() => update({ tenants: item.tenants.filter((value) => value.id !== tenant.id), signatures: item.signatures.filter((signature) => signature.personId !== tenant.id) })}>Supprimer ce locataire vide</button>}
        </div>
      ))}
      {!readonly && <button className="button secondary" onClick={() => {
        const tenant = { id: crypto.randomUUID(), civility: 'M.', firstName: '', lastName: '', phone: '', email: '', newAddress: '' };
        update({ tenants: [...item.tenants, tenant], signatures: [...item.signatures, { id: crypto.randomUUID(), personId: tenant.id, name: '', role: 'Locataire', acceptedRead: false, refused: false, refusalReason: '', observation: '' }] });
      }}>Ajouter un locataire</button>}
    </section>
  );
}

function PersonFields({ person, onChange, readonly, address, exit }: { person: Person; onChange: (person: Person) => void; readonly?: boolean; address?: boolean; exit?: boolean }) {
  return (
    <div className="grid two person">
      <Field label="Civilité" value={person.civility} readonly={readonly} onChange={(civility) => onChange({ ...person, civility })} />
      <Field label="Nom" value={person.lastName} readonly={readonly} onChange={(lastName) => onChange({ ...person, lastName })} />
      <Field label="Prénom" value={person.firstName} readonly={readonly} onChange={(firstName) => onChange({ ...person, firstName })} />
      {address && <Field label="Adresse" value={person.address || ''} readonly={readonly} onChange={(value) => onChange({ ...person, address: value })} />}
      <Field label="Téléphone" value={person.phone} readonly={readonly} onChange={(phone) => onChange({ ...person, phone })} />
      <Field label="Adresse électronique" value={person.email} readonly={readonly} onChange={(email) => onChange({ ...person, email })} />
      {exit && <Field label="Nouvelle adresse" value={person.newAddress || ''} readonly={readonly} onChange={(newAddress) => onChange({ ...person, newAddress })} />}
    </div>
  );
}

function MetersKeys({ item, update, readonly }: { item: InspectionCase; update: (patch: Partial<InspectionCase>) => void; readonly?: boolean }) {
  const setMeter = (meter: Meter) => update({ meters: item.meters.map((value) => value.id === meter.id ? meter : value) });
  const setKey = (key: AccessKey) => update({ keys: item.keys.map((value) => value.id === key.id ? key : value) });
  return (
    <section className="panel">
      <h2>Compteurs et clés</h2>
      {item.meters.map((meter) => (
        <details key={meter.id} open>
          <summary>{meter.kind}</summary>
          <div className="grid two">
            {(['number', 'location', 'index', 'unit', 'peakHours', 'offPeakHours', 'observation'] as const).map((key) => (
              <Field key={key} label={key} value={meter[key]} readonly={readonly} onChange={(value) => setMeter({ ...meter, [key]: value })} />
            ))}
          </div>
          <PhotoInput photos={meter.photos} readonly={readonly} onChange={(photos) => setMeter({ ...meter, photos })} />
        </details>
      ))}
      {!readonly && <button className="button secondary" onClick={() => update({ meters: [...item.meters, makeMeter('Autre compteur')] })}>Ajouter un compteur</button>}
      <div className="caseGrid keys">
        {item.keys.map((accessKey) => (
          <article className="caseCard" key={accessKey.id}>
            <Field label="Désignation" value={accessKey.label} readonly={readonly} onChange={(label) => setKey({ ...accessKey, label })} />
            <Field label="Quantité remise" type="number" value={String(accessKey.delivered)} readonly={readonly} onChange={(delivered) => setKey({ ...accessKey, delivered: Number(delivered) })} />
            <Field label="Quantité restituée" type="number" value={String(accessKey.returned)} readonly={readonly} onChange={(returned) => setKey({ ...accessKey, returned: Number(returned) })} />
            <Field label="État" value={accessKey.condition} readonly={readonly} onChange={(condition) => setKey({ ...accessKey, condition })} />
            <Field label="Observation" value={accessKey.observation} readonly={readonly} onChange={(observation) => setKey({ ...accessKey, observation })} />
          </article>
        ))}
      </div>
      {!readonly && <button className="button secondary" onClick={() => update({ keys: [...item.keys, makeKey('Autre')] })}>Ajouter une clé ou un accès</button>}
    </section>
  );
}

function Rooms({ item, update, readonly }: { item: InspectionCase; update: (patch: Partial<InspectionCase>) => void; readonly?: boolean }) {
  const [selected, setSelected] = useState(includedRooms(item.rooms)[0]?.id || item.rooms[0]?.id);
  const [view, setView] = useState<'included' | 'available'>('included');
  const roomsInView = view === 'included' ? includedRooms(item.rooms) : item.rooms.filter((value) => value.included === false);
  const room = roomsInView.find((value) => value.id === selected) || roomsInView[0];
  const setRoom = (next: Room) => update({ rooms: item.rooms.map((value) => value.id === next.id ? next : value) });
  const setRoomIncluded = (next: Room, included: boolean) => {
    if (!included && roomHasData(next) && !confirm('Cette pièce contient déjà des données ou des photos. La désactiver ?')) return;
    update({ rooms: item.rooms.map((value) => value.id === next.id ? { ...value, included } : value) });
    setSelected(item.rooms.find((value) => value.id !== next.id && (included ? value.included === false : value.included !== false))?.id ?? '');
  };
  const moveRoom = (next: Room, direction: -1 | 1) => {
    const index = item.rooms.findIndex((value) => value.id === next.id);
    const target = index + direction;
    if (target < 0 || target >= item.rooms.length) return;
    const copy = [...item.rooms];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    update({ rooms: copy });
  };
  return (
    <section className="panel">
      <h2>Pièces</h2>
      <div className="segmented">
        <button className={view === 'included' ? 'active' : ''} onClick={() => { setView('included'); setSelected(includedRooms(item.rooms)[0]?.id ?? ''); }}>Pièces incluses</button>
        <button className={view === 'available' ? 'active' : ''} onClick={() => { setView('available'); setSelected(item.rooms.find((value) => value.included === false)?.id ?? ''); }}>Pièces disponibles</button>
      </div>
      <div className="roomTabs">{roomsInView.map((value) => <button className={value.id === room?.id ? 'active' : ''} key={value.id} onClick={() => setSelected(value.id)}>{value.name}</button>)}</div>
      {!readonly && (
        <div className="photoActions">
          <select aria-label="Pièce à ajouter" onChange={(event) => { if (event.target.value) update({ rooms: [...item.rooms, makeRoom(event.target.value)] }); }}>
            <option value="">Ajouter une pièce</option>
            {roomNames.map((name) => <option key={name}>{name}</option>)}
          </select>
          {room && <button className="button secondary" onClick={() => setRoomIncluded(room, room.included === false)}> {room.included === false ? 'Inclure cette pièce' : 'Désactiver cette pièce'}</button>}
          {room && <button className="button secondary" onClick={() => moveRoom(room, -1)}>Monter</button>}
          {room && <button className="button secondary" onClick={() => moveRoom(room, 1)}>Descendre</button>}
          {room && <button className="button secondary" onClick={() => update({ rooms: [...item.rooms, structuredClone({ ...room, id: crypto.randomUUID(), name: `${room.name} copie`, included: true })] })}>Dupliquer</button>}
        </div>
      )}
      {room && (
        <article className="roomSheet">
          <Field label="Nom de la pièce" value={room.name} readonly={readonly} onChange={(name) => setRoom({ ...room, name })} />
          <label><span>État général</span><select disabled={readonly} value={room.generalCondition} onChange={(event) => setRoom({ ...room, generalCondition: event.target.value as Room['generalCondition'] })}>{conditionOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
          <Field label="Propreté" value={room.cleanliness} readonly={readonly} onChange={(cleanliness) => setRoom({ ...room, cleanliness })} />
          <label><span>Observations générales</span><textarea disabled={readonly} value={room.observations} onChange={(event) => setRoom({ ...room, observations: event.target.value })} /></label>
          <PhotoInput photos={room.photos} roomId={room.id} readonly={readonly} onChange={(photos) => setRoom({ ...room, photos })} />
          <h3>Éléments</h3>
          {visibleElements(room.elements).map((element) => <ElementEditor key={element.id} element={element} room={room} inspectionType={item.type} readonly={readonly} setRoom={setRoom} />)}
          {room.elements.some((element) => withElementDefaults(element).presenceStatus === 'hidden') && (
            <details>
              <summary>Équipements disponibles masqués</summary>
              <div className="caseGrid">
                {room.elements.map(withElementDefaults).filter((element) => element.presenceStatus === 'hidden').map((element) => (
                  <article className="caseCard" key={element.id}>
                    <strong>{element.label}</strong>
                    {!readonly && <button onClick={() => setRoom({ ...room, elements: room.elements.map((value) => value.id === element.id ? withElementDefaults({ ...element, presenceStatus: 'included' }) : value) })}>Activer</button>}
                  </article>
                ))}
              </div>
            </details>
          )}
          {!readonly && <button className="button secondary" onClick={() => setRoom({ ...room, elements: [...room.elements, makeElement('Autre équipement')] })}>Ajouter un élément</button>}
        </article>
      )}
    </section>
  );
}

function ElementEditor({ element: rawElement, room, inspectionType, readonly, setRoom }: { element: RoomElement; room: Room; inspectionType: InspectionType; readonly?: boolean; setRoom: (room: Room) => void }) {
  const element = withElementDefaults(rawElement);
  const setElement = (patch: Partial<RoomElement>) => setRoom({ ...room, elements: room.elements.map((value) => value.id === element.id ? withElementDefaults({ ...element, ...patch }) : value) });
  return (
    <details>
      <summary>{element.label} · {element.condition}{element.isTestable && element.functionStatus ? ` · ${element.functionStatus}` : ''}</summary>
      <div className="grid two">
        <label><span>Statut</span><select disabled={readonly} value={element.presenceStatus || 'included'} onChange={(event) => setElement({ presenceStatus: event.target.value as RoomElement['presenceStatus'], condition: event.target.value === 'absent' ? 'absent' : element.condition })}>{presenceStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <Field label="Désignation" value={element.label} readonly={readonly} onChange={(label) => setElement({ label })} />
        {element.presenceStatus === 'absent' && <p className="hint">Cet équipement apparaîtra dans le PDF comme absent lors de l’état des lieux.</p>}
        {element.presenceStatus !== 'absent' && (
          <>
        <label><span>État</span><select disabled={readonly} value={element.condition} onChange={(event) => setElement({ condition: event.target.value as typeof element.condition })}>{conditionOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
        {element.category === 'electromenager' && (
          <>
            <Field label="Marque" value={element.brand || ''} readonly={readonly} onChange={(brand) => setElement({ brand })} />
            <Field label="Modèle" value={element.model || ''} readonly={readonly} onChange={(model) => setElement({ model })} />
            <Field label="Numéro de série" value={element.serialNumber || ''} readonly={readonly} onChange={(serialNumber) => setElement({ serialNumber })} />
            <Field label="Couleur" value={element.color || ''} readonly={readonly} onChange={(color) => setElement({ color })} />
            <label><span>État extérieur</span><select disabled={readonly} value={element.exteriorCondition || ''} onChange={(event) => setElement({ exteriorCondition: event.target.value as typeof element.exteriorCondition })}><option value="">Non renseigné</option>{conditionOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label><span>État intérieur</span><select disabled={readonly} value={element.interiorCondition || ''} onChange={(event) => setElement({ interiorCondition: event.target.value as typeof element.interiorCondition })}><option value="">Non renseigné</option>{conditionOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
            <Field label="Propreté" value={element.cleanliness || ''} readonly={readonly} onChange={(cleanliness) => setElement({ cleanliness })} />
            <Field label="Accessoires présents" value={element.accessories || ''} readonly={readonly} onChange={(accessories) => setElement({ accessories })} />
          </>
        )}
        <label><span>Description précise</span><textarea required={['état moyen', 'mauvais état', 'hors service'].includes(element.condition)} disabled={readonly} value={element.description} onChange={(event) => setElement({ description: event.target.value })} placeholder="Ex. Deux trous d’environ 5 mm sur le mur côté fenêtre, à environ 1 mètre du sol." /></label>
        {element.isTestable && <label><span>Fonctionnement</span><select disabled={readonly} value={element.functionStatus || 'non testé'} onChange={(event) => setElement({ functionStatus: event.target.value as typeof element.functionStatus })}>{functionStatusOptions.map((option) => <option key={option}>{option}</option>)}</select></label>}
        {element.category === 'electromenager' && <Field label="Description du défaut" value={element.defectDescription || ''} readonly={readonly} onChange={(defectDescription) => setElement({ defectDescription })} />}
          </>
        )}
        <Field label="Observations" value={element.observation} readonly={readonly} onChange={(observation) => setElement({ observation })} />
      </div>
      {inspectionType === 'exit' && <Field label="Observations de sortie" value={element.exitObservation || ''} readonly={readonly} onChange={(exitObservation) => setElement({ exitObservation })} />}
      <PhotoInput photos={element.photos} roomId={room.id} elementId={element.id} readonly={readonly} onChange={(photos) => setElement({ photos })} />
    </details>
  );
}

function Summary({ item, issues, go }: { item: InspectionCase; issues: { section: string; message: string }[]; go: (step: number) => void }) {
  const activeRooms = includedRooms(item.rooms);
  const anomalies = activeRooms.flatMap((room) => visibleElements(room.elements).filter((element) => ['état moyen', 'mauvais état', 'hors service', 'absent'].includes(element.condition) || element.presenceStatus === 'absent').map((element) => `${room.name} - ${element.label} : ${element.presenceStatus === 'absent' ? 'absent constaté' : element.condition}`));
  return (
    <section className="panel">
      <h2>Synthèse avant signature</h2>
      <div className="summaryGrid">
        <button onClick={() => go(0)}>Logement<br /><strong>{item.address || 'Adresse manquante'}</strong></button>
        <button onClick={() => go(1)}>Parties<br /><strong>{nameOf(item.lessor)} / {namedPeople(item.tenants).map(nameOf).join(', ')}</strong></button>
        <button onClick={() => go(2)}>Compteurs<br /><strong>{item.meters.length} compteur(s)</strong></button>
        <button onClick={() => go(3)}>Pièces<br /><strong>{activeRooms.length} pièce(s)</strong></button>
      </div>
      <h3>Anomalies recensées</h3>
      {anomalies.length ? anomalies.map((line) => <p key={line} className="warning">{line}</p>) : <p className="hint">Aucune anomalie importante détectée.</p>}
      <h3>Champs à vérifier</h3>
      {issues.length ? issues.map((issue) => <button key={issue.message} className="issue" onClick={() => go({ general: 0, parties: 1, meters: 2, rooms: 3, signatures: 5 }[issue.section] ?? 0)}>{issue.message}</button>) : <p className="ok">Aucun point bloquant détecté.</p>}
      <label><span>Observations générales du bailleur</span><textarea value={item.observations.lessor} readOnly /></label>
      <label><span>Observations générales du locataire</span><textarea value={item.observations.tenant} readOnly /></label>
    </section>
  );
}

function Signatures({ item, update, readonly }: { item: InspectionCase; update: (patch: Partial<InspectionCase>) => void; readonly?: boolean }) {
  return (
    <section className="panel">
      <h2>Signatures</h2>
      <p className="hint">Cette signature manuscrite sur écran matérialise la prise de connaissance du document. Elle n’est pas présentée comme une signature électronique qualifiée ou certifiée.</p>
      {item.signatures.filter((signature) => signature.name.trim()).map((signature) => <SignaturePad key={signature.id} signature={signature} readonly={readonly} onChange={(next) => update({ signatures: item.signatures.map((value) => value.id === next.id ? next : value) })} />)}
    </section>
  );
}

function PdfStep({ item, readonly, finalize, sharePdf, setCurrent }: { item: InspectionCase; readonly?: boolean; finalize: () => Promise<void>; sharePdf: () => Promise<void>; setCurrent: (item: InspectionCase) => void }) {
  return (
    <section className="panel">
      <h2>Génération et partage</h2>
      <p className="hint">Le PDF final est généré dans le navigateur. Les photos sont compressées et les rubriques vides sont masquées.</p>
      {!readonly && <button className="button primary large" onClick={() => void finalize()}><FileCheck /> Finaliser et générer le PDF</button>}
      {item.pdfDataUrl && (
        <div className="homeActions">
          <button className="button secondary" onClick={() => downloadDataUrl(item.pdfDataUrl!, `${item.id}.pdf`)}><Download size={18} /> Télécharger le PDF</button>
          <button className="button secondary" onClick={() => window.print()}><Printer size={18} /> Imprimer</button>
          <button className="button secondary" onClick={() => void sharePdf()}><Share2 size={18} /> Partager</button>
          <button className="button secondary" onClick={() => downloadText(exportCaseJson(item), `${item.id}-dossier.json`)}><Download size={18} /> Exporter le dossier</button>
          <button className="button secondary" onClick={() => setCurrent(duplicateCase(item, item.type))}><FilePlus2 size={18} /> Créer une nouvelle version</button>
        </div>
      )}
      {item.pdfHash && <p className="seal">Empreinte SHA-256 du PDF : <code>{item.pdfHash}</code></p>}
    </section>
  );
}
