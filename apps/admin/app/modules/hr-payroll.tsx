'use client';
import { authFetch } from '../auth-fetch';
// Modul HR & Payroll — karyawan, periode, payroll run, pembayaran, dan kewajiban payroll.
import { useEffect, useMemo, useState } from 'react';
import { Panel, Table, StatusChip, rupiah, tanggal } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Employee = { id: string; employeeNumber: string; fullName: string; isActive?: boolean; departmentId?: string | null; positionId?: string | null };
type WorkShift = { id: string; code: string; name: string; startMinute: number; endMinute: number; isActive: boolean };
type EmployeeSchedule = { id: string; employeeId: string; shiftId?: string | null; workDate: string; isDayOff: boolean; notes?: string | null };
type AttendancePolicy = { id: string; code: string; name: string; allowedMethods: string[]; requirePhoto: boolean; requireLocation: boolean; isActive: boolean };
type AttendanceCorrection = { id: string; employeeId: string; attendanceRecordId?: string | null; reason: string; status: string; proposedData: Record<string, unknown>; createdAt: string };
type AttendanceDevice = { id: string; code: string; name: string; deviceType: string; vendor?: string | null; status: string };
type AttendanceGeofence = { id: string; code: string; name: string; latitude: string | number; longitude: string | number; radiusMeters: number; isActive: boolean };
type BiometricCredential = { id: string; employeeId: string; biometricType: string; deviceUserCode: string; status: string; revokedAt?: string | null };
type Department = { id: string; code: string; name: string };
type Position = { id: string; code: string; name: string; departmentId?: string | null };
type Account = { id: string; code: string; name: string; isActive?: boolean };
type PayrollAccountingMapping = { id: string; componentCode: string; debitAccountId?: string | null; creditAccountId?: string | null; isActive: boolean };
type EmployeeProfiles = { employeeId: string; supportedTaxMethods: string[]; taxProfiles: Array<{ id: string; taxStatusCode?: string | null; taxMethod: string; effectiveFrom: string; effectiveTo?: string | null }>; socialSecurityProfiles: Array<{ id: string; wageBase?: string | number | null; programs: string[]; effectiveFrom: string; effectiveTo?: string | null }> };
type PayrollPeriod = { id: string; code: string; year: number; month: number; startDate: string; endDate: string; status: string };
type RuleSet = { id: string; code: string; name: string; version: number; status: string; effectiveFrom: string };
type PayrollRun = {
  id: string; number: string; status: string; payrollPeriodId: string; taxRuleSetId?: string | null; socialSecurityRuleSetId?: string | null;
  employeeCount: number; grossTotal: string | number; deductionTotal: string | number; taxTotal: string | number; employerContributionTotal: string | number; netTotal: string | number; createdAt: string;
  adjustmentOfRunId?: string | null; adjustmentSequence?: number; adjustmentReason?: string | null; adjustmentPostingDate?: string | null;
};
type PayrollResult = { id: string; employeeId: string; status: string; grossPay: string | number; taxableIncome: string | number; incomeTax: string | number; employeeContribution: string | number; netPay: string | number };
type PayrollPayment = { id: string; employeeId: string; amount: string | number; status: string; paymentMethod: string; direction?: 'OUTBOUND' | 'RECOVERY' | string; settlementAccountCode?: string | null; paidAt?: string | null };
type LiabilityBucket = { recognized: string; paid: string; pending: string; outstanding: string; availableToPay?: string };
type PayrollLiability = { payrollRunId: string; number: string; status: string; salary: LiabilityBucket; tax: LiabilityBucket; socialAndOther: LiabilityBucket; recovery?: LiabilityBucket };
type LeaveRequest = { id: string; employeeId: string; leaveTypeId: string; startDate: string; endDate: string; totalDays: string | number; reason?: string | null; status: string; createdAt: string };
type OvertimeRequest = { id: string; employeeId: string; requestedStart: string; requestedEnd: string; approvedMinutes?: number | null; reason?: string | null; status: string; createdAt: string };
type LeaveType = { id: string; code: string; name: string; annualQuota?: string | number | null };

function monthParts(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const mm = String(month).padStart(2, '0');
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { year, month, mm, startDate: `${year}-${mm}-01`, endDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` };
}

function requestKey(prefix: string, id: string, account: string) {
  return `${prefix}:${id}:${account}`;
}



function minuteLabel(value: number) {
  const h = Math.floor(value / 60) % 24;
  const m = value % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function minuteValue(value: string) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function R2HrConfiguration({ token, employees, mode }: { token: string; employees: Employee[]; mode: 'attendance' | 'payroll' | 'compliance' | string }) {
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [schedules, setSchedules] = useState<EmployeeSchedule[]>([]);
  const [policies, setPolicies] = useState<AttendancePolicy[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [devices, setDevices] = useState<AttendanceDevice[]>([]);
  const [geofences, setGeofences] = useState<AttendanceGeofence[]>([]);
  const [biometrics, setBiometrics] = useState<BiometricCredential[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [mappings, setMappings] = useState<PayrollAccountingMapping[]>([]);
  const [profileEmployeeId, setProfileEmployeeId] = useState('');
  const [profiles, setProfiles] = useState<EmployeeProfiles | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await authFetch(`${API}${path}`, token, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Permintaan HR gagal.');
    return data as T;
  }

  async function refreshAttendance() {
    const from = new Date(); from.setDate(1);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    const [shiftRows, scheduleRows, policyRows, correctionRows, deviceRows, geofenceRows, biometricRows, departmentRows, positionRows] = await Promise.all([
      api<WorkShift[]>('/attendance/work-shifts'),
      api<EmployeeSchedule[]>(`/attendance/schedules?from=${from.toLocaleDateString('en-CA')}&to=${to.toLocaleDateString('en-CA')}`),
      api<AttendancePolicy[]>('/attendance/policies'),
      api<AttendanceCorrection[]>('/attendance/corrections'),
      api<AttendanceDevice[]>('/attendance/devices'),
      api<AttendanceGeofence[]>('/attendance/geofences'),
      api<BiometricCredential[]>('/attendance/biometrics'),
      api<Department[]>('/hr/departments'),
      api<Position[]>('/hr/positions'),
    ]);
    setShifts(shiftRows); setSchedules(scheduleRows); setPolicies(policyRows); setCorrections(correctionRows);
    setDevices(deviceRows); setGeofences(geofenceRows); setBiometrics(biometricRows); setDepartments(departmentRows); setPositions(positionRows);
  }

  async function refreshPayrollConfig(employeeId = profileEmployeeId || employees[0]?.id || '') {
    const [mappingRows, accountRows] = await Promise.all([
      api<PayrollAccountingMapping[]>('/payroll/accounting-mappings'),
      api<Account[]>('/accounting-core/accounts'),
    ]);
    setMappings(mappingRows); setAccounts(accountRows);
    if (employeeId) { setProfileEmployeeId(employeeId); setProfiles(await api<EmployeeProfiles>(`/payroll/employee-profiles/${employeeId}`)); }
  }

  useEffect(() => {
    const load = mode === 'attendance' ? refreshAttendance() : refreshPayrollConfig();
    load.catch((error) => setMessage(error instanceof Error ? error.message : 'Gagal memuat konfigurasi HR.'));
  }, [token, mode]);

  async function run(work: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await work(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Operasi HR gagal.'); }
    finally { setBusy(false); }
  }

  if (mode === 'attendance') return <>
    <Panel eyebrow="R2 · ROSTER" title="Shift & Jadwal Karyawan" badge={`${shifts.length} shift · ${schedules.length} roster bulan ini`}>
      <form className="inline" onSubmit={(event) => { event.preventDefault(); const fd = new FormData(event.currentTarget); void run(async () => {
        await api('/attendance/work-shifts', { method:'POST', body: JSON.stringify({ code:fd.get('code'), name:fd.get('name'), startMinute:minuteValue(String(fd.get('start'))), endMinute:minuteValue(String(fd.get('end'))), crossesMidnight: Boolean(fd.get('crossesMidnight')), breakMinutes:Number(fd.get('breakMinutes') || 0) }) });
        event.currentTarget.reset(); await refreshAttendance(); setMessage('WorkShift berhasil dibuat.');
      }); }}>
        <label>Kode<input name="code" required placeholder="SHIFT-PAGI" /></label><label>Nama<input name="name" required placeholder="Shift Pagi" /></label>
        <label>Mulai<input name="start" type="time" required defaultValue="08:00" /></label><label>Selesai<input name="end" type="time" required defaultValue="17:00" /></label>
        <label>Istirahat (menit)<input name="breakMinutes" type="number" min="0" defaultValue="60" /></label><label className="checkboxLabel"><input name="crossesMidnight" type="checkbox" />Lintas tengah malam</label>
        <button disabled={busy}>Tambah shift</button>
      </form>
      <Table head={['Kode','Nama','Jam','Status','Aksi']} rows={shifts.map((shift) => [shift.code, shift.name, `${minuteLabel(shift.startMinute)}–${minuteLabel(shift.endMinute)}`, <StatusChip status={shift.isActive?'ACTIVE':'INACTIVE'} />, <button type="button" className="secondary" disabled={busy} onClick={() => void run(async()=>{ await api(`/attendance/work-shifts/${shift.id}`, {method:'PATCH',body:JSON.stringify({...shift,isActive:!shift.isActive})}); await refreshAttendance(); })}>{shift.isActive?'Nonaktifkan':'Aktifkan'}</button>])} empty="Belum ada WorkShift." />
      <form className="inline" onSubmit={(event) => { event.preventDefault(); const fd=new FormData(event.currentTarget); void run(async()=>{ await api('/attendance/schedules',{method:'POST',body:JSON.stringify({employeeId:fd.get('employeeId'),workDate:fd.get('workDate'),shiftId:fd.get('isDayOff')?undefined:fd.get('shiftId'),isDayOff:Boolean(fd.get('isDayOff')),notes:fd.get('notes')||undefined})}); await refreshAttendance(); setMessage('Roster diperbarui.'); }); }}>
        <label>Karyawan<select name="employeeId" required defaultValue=""><option value="" disabled>Pilih</option>{employees.map(e=><option key={e.id} value={e.id}>{e.employeeNumber} · {e.fullName}</option>)}</select></label>
        <label>Tanggal<input type="date" name="workDate" required /></label><label>Shift<select name="shiftId" defaultValue=""><option value="">Pilih shift</option>{shifts.filter(s=>s.isActive).map(s=><option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select></label>
        <label className="checkboxLabel"><input type="checkbox" name="isDayOff" />Hari libur</label><label>Catatan<input name="notes" /></label><button disabled={busy}>Simpan roster</button>
      </form>
      <Table head={['Tanggal','Karyawan','Shift','Status']} rows={schedules.slice(0,100).map(row=>[tanggal(row.workDate), employees.find(e=>e.id===row.employeeId)?.fullName ?? row.employeeId, row.shiftId ? shifts.find(s=>s.id===row.shiftId)?.name ?? row.shiftId : '-', row.isDayOff?'OFF':'WORK'])} empty="Belum ada roster bulan ini." />
    </Panel>

    <section className="grid2">
      <Panel eyebrow="R2 · POLICY" title="Attendance Policy" badge={`${policies.length} policy`}>
        <form className="formGrid" onSubmit={(event)=>{event.preventDefault(); const fd=new FormData(event.currentTarget); void run(async()=>{ await api('/attendance/policies',{method:'POST',body:JSON.stringify({code:fd.get('code'),name:fd.get('name'),allowedMethods:String(fd.get('allowedMethods')||'').split(',').map(v=>v.trim()).filter(Boolean),requirePhoto:Boolean(fd.get('requirePhoto')),requireLocation:Boolean(fd.get('requireLocation')),allowOutsideGeofence:Boolean(fd.get('allowOutsideGeofence')),maxLocationAccuracyMeters:Number(fd.get('accuracy')||0)||undefined})}); event.currentTarget.reset(); await refreshAttendance(); setMessage('AttendancePolicy berhasil dibuat.'); });}}>
          <label>Kode<input name="code" required /></label><label>Nama<input name="name" required /></label><label>Metode (koma)<input name="allowedMethods" defaultValue="MOBILE_GPS,SELFIE_GPS,FINGERPRINT" required /></label><label>Akurasi maks (m)<input name="accuracy" type="number" min="1" defaultValue="100" /></label>
          <label className="checkboxLabel"><input name="requirePhoto" type="checkbox" />Wajib foto</label><label className="checkboxLabel"><input name="requireLocation" type="checkbox" />Wajib lokasi</label><label className="checkboxLabel"><input name="allowOutsideGeofence" type="checkbox" />Izinkan luar geofence</label><button disabled={busy}>Tambah policy</button>
        </form>
        <Table head={['Kode','Nama','Metode','Status']} rows={policies.map(p=>[p.code,p.name,Array.isArray(p.allowedMethods)?p.allowedMethods.join(', '):String(p.allowedMethods),<StatusChip status={p.isActive?'ACTIVE':'INACTIVE'} />])} empty="Belum ada policy." />
      </Panel>
      <Panel eyebrow="R2 · PLACEMENT" title="Effective-dated Assignment" badge="Tenant-safe">
        <form className="formGrid" onSubmit={(event)=>{event.preventDefault(); const fd=new FormData(event.currentTarget); void run(async()=>{ await api('/hr/assignments',{method:'POST',body:JSON.stringify({employeeId:fd.get('employeeId'),departmentId:fd.get('departmentId')||undefined,positionId:fd.get('positionId')||undefined,managerEmployeeId:fd.get('managerEmployeeId')||undefined,effectiveFrom:fd.get('effectiveFrom'),effectiveTo:fd.get('effectiveTo')||undefined,isPrimary:true})}); event.currentTarget.reset(); setMessage('EmployeeAssignment berhasil dibuat.'); });}}>
          <label>Karyawan<select name="employeeId" required defaultValue=""><option value="" disabled>Pilih</option>{employees.map(e=><option key={e.id} value={e.id}>{e.fullName}</option>)}</select></label>
          <label>Department<select name="departmentId" defaultValue=""><option value="">-</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label>Position<select name="positionId" defaultValue=""><option value="">-</option>{positions.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label>Manager<select name="managerEmployeeId" defaultValue=""><option value="">-</option>{employees.map(e=><option key={e.id} value={e.id}>{e.fullName}</option>)}</select></label>
          <label>Berlaku dari<input name="effectiveFrom" type="date" required /></label><label>Sampai<input name="effectiveTo" type="date" /></label><button disabled={busy}>Tambah assignment</button>
        </form>
        <div className="notice">Primary assignment tidak boleh overlap. Assignment aktif menyinkronkan branch/department/position/manager pada Employee master.</div>
      </Panel>
    </section>

    <Panel eyebrow="R2 · ATTENDANCE CORRECTION" title="Koreksi Absensi" badge={`${corrections.filter(c=>c.status==='SUBMITTED').length} menunggu`}>
      <Table head={['Karyawan','Alasan','Usulan','Status','Aksi']} rows={corrections.map(c=>[employees.find(e=>e.id===c.employeeId)?.fullName ?? c.employeeId,c.reason,<code>{JSON.stringify(c.proposedData)}</code>,<StatusChip status={c.status} />,c.status==='SUBMITTED'?<div className="rowActions"><button type="button" disabled={busy} onClick={()=>void run(async()=>{await api(`/attendance/corrections/${c.id}/review`,{method:'POST',body:JSON.stringify({status:'APPROVED',reviewNotes:'Disetujui operator HR'})});await refreshAttendance();})}>Approve</button><button type="button" className="secondary" disabled={busy} onClick={()=>void run(async()=>{await api(`/attendance/corrections/${c.id}/review`,{method:'POST',body:JSON.stringify({status:'REJECTED',reviewNotes:'Ditolak operator HR'})});await refreshAttendance();})}>Reject</button></div>:'-'])} empty="Tidak ada koreksi absensi." />
      <div className="notice">Approval ditolak otomatis bila attendance record sudah dikunci payroll; periode terkunci harus dikoreksi lewat payroll adjustment.</div>
    </Panel>

    <section className="grid2">
      <Panel eyebrow="R2 · DEVICE" title="Attendance Devices" badge={`${devices.length} device`}>
        <form className="formGrid" onSubmit={(event)=>{event.preventDefault();const fd=new FormData(event.currentTarget);void run(async()=>{await api('/attendance/devices',{method:'POST',body:JSON.stringify({code:fd.get('code'),name:fd.get('name'),deviceType:fd.get('deviceType'),vendor:fd.get('vendor')||undefined,serialNumber:fd.get('serialNumber')||undefined})});event.currentTarget.reset();await refreshAttendance();});}}>
          <label>Kode<input name="code" required /></label><label>Nama<input name="name" required /></label><label>Jenis<input name="deviceType" required defaultValue="FINGERPRINT" /></label><label>Vendor<input name="vendor" /></label><label>Serial<input name="serialNumber" /></label><button disabled={busy}>Daftarkan device</button>
        </form>
        <Table head={['Kode','Nama','Jenis','Status','Aksi']} rows={devices.map(d=>[d.code,d.name,d.deviceType,<StatusChip status={d.status}/>,<button type="button" className="secondary" disabled={busy} onClick={()=>void run(async()=>{await api(`/attendance/devices/${d.id}`,{method:'PATCH',body:JSON.stringify({status:d.status==='ACTIVE'?'INACTIVE':'ACTIVE'})});await refreshAttendance();})}>{d.status==='ACTIVE'?'Nonaktifkan':'Aktifkan'}</button>])} empty="Belum ada device." />
      </Panel>
      <Panel eyebrow="R2 · GEOFENCE" title="Geofence" badge={`${geofences.length} area`}>
        <form className="formGrid" onSubmit={(event)=>{event.preventDefault();const fd=new FormData(event.currentTarget);void run(async()=>{await api('/attendance/geofences',{method:'POST',body:JSON.stringify({code:fd.get('code'),name:fd.get('name'),latitude:Number(fd.get('latitude')),longitude:Number(fd.get('longitude')),radiusMeters:Number(fd.get('radiusMeters')),allowedAccuracyMeters:Number(fd.get('accuracy')||0)||undefined})});event.currentTarget.reset();await refreshAttendance();});}}>
          <label>Kode<input name="code" required /></label><label>Nama<input name="name" required /></label><label>Latitude<input name="latitude" type="number" step="any" required /></label><label>Longitude<input name="longitude" type="number" step="any" required /></label><label>Radius m<input name="radiusMeters" type="number" min="5" required /></label><label>Akurasi m<input name="accuracy" type="number" min="1" /></label><button disabled={busy}>Tambah geofence</button>
        </form>
        <Table head={['Kode','Nama','Radius','Status']} rows={geofences.map(g=>[g.code,g.name,`${g.radiusMeters} m`,<StatusChip status={g.isActive?'ACTIVE':'INACTIVE'} />])} empty="Belum ada geofence." />
      </Panel>
    </section>

    <Panel eyebrow="R2 · BIOMETRIC" title="Biometric / Fingerprint Credentials" badge={`${biometrics.length} credential`}>
      <Table head={['Karyawan','Jenis','Device user','Status','Aksi']} rows={biometrics.map(b=>[employees.find(e=>e.id===b.employeeId)?.fullName??b.employeeId,b.biometricType,b.deviceUserCode,<StatusChip status={b.status}/>,!b.revokedAt?<button type="button" className="secondary" disabled={busy} onClick={()=>void run(async()=>{await api(`/attendance/biometrics/${b.id}`,{method:'PATCH',body:JSON.stringify({revoke:true})});await refreshAttendance();})}>Revoke</button>:'-'])} empty="Belum ada biometric credential." />
      {message && <div className="notice" style={{marginTop:12}}>{message}</div>}
    </Panel>
  </>;

  return <>
    <Panel eyebrow="R2 · PAYROLL COMPLIANCE" title="Employee Tax & Social Security Profile" badge={profiles ? `${profiles.supportedTaxMethods.join(', ')} supported` : 'Pilih karyawan'}>
      <label>Karyawan<select value={profileEmployeeId} onChange={(event)=>{const id=event.target.value;setProfileEmployeeId(id);void refreshPayrollConfig(id);}}><option value="">Pilih karyawan</option>{employees.map(e=><option key={e.id} value={e.id}>{e.employeeNumber} · {e.fullName}</option>)}</select></label>
      <section className="grid2">
        <form className="formGrid" onSubmit={(event)=>{event.preventDefault();const fd=new FormData(event.currentTarget);void run(async()=>{if(!profileEmployeeId)throw new Error('Pilih karyawan.');await api('/payroll/employee-tax-profiles',{method:'POST',body:JSON.stringify({employeeId:profileEmployeeId,taxStatusCode:fd.get('taxStatusCode')||undefined,taxMethod:'GROSS',annualizationMethod:fd.get('annualizationMethod')||undefined,effectiveFrom:fd.get('effectiveFrom'),effectiveTo:fd.get('effectiveTo')||undefined})});await refreshPayrollConfig(profileEmployeeId);setMessage('Tax profile tersimpan.');});}}>
          <h3>Tax Profile</h3><label>Status pajak<input name="taxStatusCode" placeholder="TK/0 / K/1" /></label><label>Tax method<select name="taxMethod" value="GROSS" disabled><option>GROSS</option></select><small>GROSS_UP/NET fail-closed sampai engine tervalidasi.</small></label><label>Annualization<input name="annualizationMethod" placeholder="MONTHLY / ANNUALIZED" /></label><label>Berlaku dari<input name="effectiveFrom" type="date" required /></label><label>Sampai<input name="effectiveTo" type="date" /></label><button disabled={busy||!profileEmployeeId}>Simpan tax profile</button>
        </form>
        <form className="formGrid" onSubmit={(event)=>{event.preventDefault();const fd=new FormData(event.currentTarget);void run(async()=>{if(!profileEmployeeId)throw new Error('Pilih karyawan.');await api('/payroll/employee-social-security-profiles',{method:'POST',body:JSON.stringify({employeeId:profileEmployeeId,wageBase:Number(fd.get('wageBase')||0)||undefined,programs:String(fd.get('programs')||'').split(',').map(v=>v.trim()).filter(Boolean),effectiveFrom:fd.get('effectiveFrom'),effectiveTo:fd.get('effectiveTo')||undefined})});await refreshPayrollConfig(profileEmployeeId);setMessage('Social-security profile tersimpan.');});}}>
          <h3>BPJS / Social Security</h3><label>Wage base<input name="wageBase" type="number" min="0" /></label><label>Program (koma)<input name="programs" required placeholder="JKN,JHT,JP,JKK,JKM" /></label><label>Berlaku dari<input name="effectiveFrom" type="date" required /></label><label>Sampai<input name="effectiveTo" type="date" /></label><button disabled={busy||!profileEmployeeId}>Simpan social profile</button>
        </form>
      </section>
      {profiles && <Table head={['Jenis','Berlaku','Metode/Program','Sampai']} rows={[...profiles.taxProfiles.map(p=>['Tax',tanggal(p.effectiveFrom),`${p.taxMethod} · ${p.taxStatusCode??'-'}`,p.effectiveTo?tanggal(p.effectiveTo):'-']),...profiles.socialSecurityProfiles.map(p=>['Social',tanggal(p.effectiveFrom),Array.isArray(p.programs)?p.programs.join(', '):String(p.programs),p.effectiveTo?tanggal(p.effectiveTo):'-'])]} empty="Belum ada profile effective-dated." />}
    </Panel>

    <Panel eyebrow="R2 · ACCOUNTING" title="Payroll Accounting Mapping" badge={`${mappings.length} mapping`}>
      <form className="formGrid" onSubmit={(event)=>{event.preventDefault();const fd=new FormData(event.currentTarget);void run(async()=>{await api('/payroll/accounting-mappings',{method:'POST',body:JSON.stringify({componentCode:fd.get('componentCode'),debitAccountId:fd.get('debitAccountId')||undefined,creditAccountId:fd.get('creditAccountId')||undefined,isActive:true})});await refreshPayrollConfig(profileEmployeeId);setMessage('Payroll accounting mapping tersimpan.');});}}>
        <label>Mapping<select name="componentCode" required defaultValue=""><option value="" disabled>Pilih</option><option value="__PAYROLL_EXPENSE__">Payroll Expense</option><option value="__SALARY_PAYABLE__">Salary Payable</option><option value="__PAYROLL_TAX_PAYABLE__">Payroll Tax Payable</option><option value="__PAYROLL_OTHER_PAYABLE__">Payroll Other/BPJS Payable</option><option value="__PAYROLL_RECEIVABLE__">Employee Receivable</option></select></label>
        <label>Debit account<select name="debitAccountId" defaultValue=""><option value="">-</option>{accounts.filter(a=>a.isActive!==false).map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label>
        <label>Credit account<select name="creditAccountId" defaultValue=""><option value="">-</option>{accounts.filter(a=>a.isActive!==false).map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label><button disabled={busy}>Simpan mapping</button>
      </form>
      <Table head={['Kode','Debit','Credit','Status']} rows={mappings.map(m=>[m.componentCode,accounts.find(a=>a.id===m.debitAccountId)?.code??'-',accounts.find(a=>a.id===m.creditAccountId)?.code??'-',<StatusChip status={m.isActive?'ACTIVE':'INACTIVE'} />])} empty="Belum ada mapping payroll branch." />
      <div className="notice">Posting payroll tetap fail-closed bila mapping wajib tidak lengkap atau akun tidak aktif/milik branch lain. Split-period/proration tidak dihitung secara implisit.</div>
      {message && <div className="notice" style={{marginTop:12}}>{message}</div>}
    </Panel>
  </>;
}

export default function HrPayrollView({ token, mode = 'payroll' }: { token: string; mode?: string }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [taxRules, setTaxRules] = useState<RuleSet[]>([]);
  const [socialRules, setSocialRules] = useState<RuleSet[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [results, setResults] = useState<PayrollResult[]>([]);
  const [payments, setPayments] = useState<PayrollPayment[]>([]);
  const [liabilities, setLiabilities] = useState<PayrollLiability[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [selectedRunId, setSelectedRunId] = useState('');
  const [selectedTaxRuleId, setSelectedTaxRuleId] = useState('');
  const [selectedSocialRuleId, setSelectedSocialRuleId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [settleTarget, setSettleTarget] = useState<PayrollPayment | null>(null);
  const [settlementReference, setSettlementReference] = useState('');
  const [adjustmentSource, setAdjustmentSource] = useState<PayrollRun | null>(null);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentPostingDate, setAdjustmentPostingDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [cancelTarget, setCancelTarget] = useState<PayrollRun | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await authFetch(`${API}${path}`, token, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Permintaan gagal.');
    return data as T;
  }

  async function refreshCore() {
    const now = monthParts();
    const [emp, periodData, runData, taxData, socialData, liabilityData, leaveTypeData, leaveData, overtimeData] = await Promise.all([
      api<Employee[] | { items?: Employee[] }>('/hr/employees?limit=100'),
      api<PayrollPeriod[]>(`/payroll/periods?year=${now.year}`),
      api<PayrollRun[]>('/payroll/runs'),
      api<RuleSet[]>('/payroll/tax-rule-sets'),
      api<RuleSet[]>('/payroll/social-security-rule-sets'),
      api<PayrollLiability[]>('/payroll/liabilities'),
      api<LeaveType[]>('/hr/leave-types'),
      api<LeaveRequest[]>('/hr/leave-requests'),
      api<OvertimeRequest[]>('/hr/overtime-requests'),
    ]);
    const employeeRows = Array.isArray(emp) ? emp : emp.items ?? [];
    setEmployees(employeeRows);
    setPeriods(periodData);
    setRuns(runData);
    setTaxRules(taxData);
    setSocialRules(socialData);
    setLiabilities(liabilityData);
    setLeaveTypes(leaveTypeData);
    setLeaveRequests(leaveData);
    setOvertimeRequests(overtimeData);
    const currentPeriod = periodData.find((p) => p.year === now.year && p.month === now.month) ?? periodData[0];
    setSelectedPeriodId((current) => current || currentPeriod?.id || '');
    const firstRun = runData[0];
    setSelectedRunId((current) => current || firstRun?.id || '');
    const approvedTax = taxData.find((r) => r.status === 'APPROVED');
    const approvedSocial = socialData.find((r) => r.status === 'APPROVED');
    setSelectedTaxRuleId((current) => current || approvedTax?.id || '');
    setSelectedSocialRuleId((current) => current || approvedSocial?.id || '');
  }

  async function refreshRun(runId: string) {
    if (!runId) { setResults([]); setPayments([]); return; }
    const [resultData, paymentData] = await Promise.all([
      api<PayrollResult[]>(`/payroll/runs/${runId}/results`),
      api<PayrollPayment[]>(`/payroll/runs/${runId}/payments`),
    ]);
    setResults(resultData);
    setPayments(paymentData);
  }

  async function refreshAll(runId = selectedRunId) {
    await refreshCore();
    if (runId) await refreshRun(runId);
  }

  useEffect(() => {
    refreshCore().catch((error) => setMessage(error instanceof Error ? error.message : 'Gagal memuat HR/Payroll.'));
  }, [token]);

  useEffect(() => {
    refreshRun(selectedRunId).catch((error) => setMessage(error instanceof Error ? error.message : 'Gagal memuat detail payroll.'));
  }, [selectedRunId, token]);

  const selectedRun = runs.find((run) => run.id === selectedRunId);
  const selectedLiability = liabilities.find((row) => row.payrollRunId === (selectedRun?.adjustmentOfRunId ?? selectedRunId));
  const employeeById = useMemo(() => new Map(employees.map((row) => [row.id, row])), [employees]);
  const current = monthParts();

  async function action(work: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await work(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Operasi payroll gagal.'); }
    finally { setBusy(false); }
  }

  async function ensureCurrentPeriod() {
    await action(async () => {
      const existing = periods.find((p) => p.year === current.year && p.month === current.month);
      if (existing) { setSelectedPeriodId(existing.id); setMessage(`Periode ${existing.code} sudah tersedia.`); return; }
      const created = await api<PayrollPeriod>('/payroll/periods', {
        method: 'POST',
        body: JSON.stringify({ code: `PAY-${current.year}-${current.mm}`, year: current.year, month: current.month, startDate: current.startDate, endDate: current.endDate }),
      });
      setSelectedPeriodId(created.id);
      setMessage(`Periode ${created.code} berhasil dibuat.`);
      await refreshCore();
    });
  }

  async function createRun() {
    await action(async () => {
      if (!selectedPeriodId) throw new Error('Pilih/buat periode payroll terlebih dahulu.');
      if (!selectedTaxRuleId) throw new Error('Belum ada tax rule APPROVED. Import/verifikasi tarif resmi lalu approve rule sebelum menghitung payroll.');
      const created = await api<PayrollRun>('/payroll/runs', {
        method: 'POST',
        body: JSON.stringify({ payrollPeriodId: selectedPeriodId, taxRuleSetId: selectedTaxRuleId, socialSecurityRuleSetId: selectedSocialRuleId || undefined }),
      });
      setSelectedRunId(created.id);
      setMessage(`Payroll run ${created.number} siap diproses.`);
      await refreshAll(created.id);
    });
  }

  async function createAdjustmentRun() {
    if (!adjustmentSource) return;
    await action(async () => {
      const reason = adjustmentReason.trim();
      if (reason.length < 5) throw new Error('Alasan adjustment minimal 5 karakter agar audit trail jelas.');
      const created = await api<PayrollRun>(`/payroll/runs/${adjustmentSource.id}/adjustments`, {
        method: 'POST',
        body: JSON.stringify({ reason, postingDate: adjustmentPostingDate || undefined }),
      });
      setAdjustmentSource(null); setAdjustmentReason('');
      setSelectedRunId(created.id);
      setMessage(`Adjustment ${created.number} dibuat dari ${adjustmentSource.number}. Hitung hanya selisihnya lalu review sebelum posting.`);
      await refreshAll(created.id);
    });
  }

  async function cancelPayrollRun() {
    if (!cancelTarget) return;
    await action(async () => {
      const reason = cancelReason.trim();
      if (reason.length < 5) throw new Error('Alasan pembatalan minimal 5 karakter.');
      await api(`/payroll/runs/${cancelTarget.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
      const label = cancelTarget.adjustmentOfRunId ? 'Adjustment' : 'Payroll run';
      setCancelTarget(null); setCancelReason('');
      setMessage(`${label} ${cancelTarget.number} dibatalkan sebelum posting. Riwayat audit tetap disimpan.`);
      await refreshAll(selectedRunId);
    });
  }

  async function runStep(path: string, success: string) {
    if (!selectedRunId) return;
    await action(async () => {
      await api(path, { method: 'POST' });
      setMessage(success);
      await refreshAll(selectedRunId);
    });
  }

  async function lockAttendance() {
    if (!selectedRun) return;
    await action(async () => {
      await api(`/payroll/periods/${selectedRun.payrollPeriodId}/lock-attendance`, { method: 'POST' });
      setMessage('Absensi periode berhasil dikunci untuk branch ini.');
      await refreshAll(selectedRunId);
    });
  }

  async function settleSalary(payment: PayrollPayment, externalReference: string) {
    const reference = externalReference.trim();
    if (!reference) { setMessage('Pembayaran belum dikonfirmasi: referensi transfer bank wajib diisi.'); return; }
    await action(async () => {
      await api(`/payroll/payments/${payment.id}/settle`, {
        method: 'POST',
        body: JSON.stringify({ settlementAccountCode: '1102', paymentMethod: 'BANK_TRANSFER', externalReference: reference }),
      });
      setMessage(payment.direction === 'RECOVERY' ? 'Penerimaan recovery dikonfirmasi dan Piutang Karyawan berkurang.' : 'Transfer bank dikonfirmasi dan jurnal pelunasan Utang Gaji terbentuk.');
      setSettleTarget(null); setSettlementReference('');
      await refreshAll(selectedRunId);
    });
  }

  async function createLiabilityDraft(accountCode: '2103' | '2104', amount: number) {
    if (!selectedRun || amount <= 0) return;
    await action(async () => {
      await api('/finance-operations', {
        method: 'POST',
        body: JSON.stringify({
          type: 'PAYROLL_LIABILITY_PAYMENT',
          description: accountCode === '2103' ? `Pelunasan PPh payroll ${selectedRun.number}` : `Pelunasan BPJS/potongan payroll ${selectedRun.number}`,
          amount,
          debitAccountCode: accountCode,
          creditAccountCode: '1102',
          paymentMethod: 'BANK_TRANSFER',
          referenceType: 'PayrollRun',
          referenceId: selectedRun.id,
          idempotencyKey: requestKey('payroll-liability', selectedRun.id, accountCode),
        }),
      });
      setMessage('Draft settlement kewajiban payroll dibuat. Posting final dilakukan dari menu Akuntansi setelah pembayaran eksternal benar-benar dilakukan.');
      await refreshAll(selectedRunId);
    });
  }


  async function reviewLeaveRequest(id: string, status: 'APPROVED' | 'REJECTED') {
    await action(async () => {
      await api(`/hr/leave-requests/${id}/review`, { method: 'POST', body: JSON.stringify({ status }) });
      setMessage(status === 'APPROVED' ? 'Pengajuan cuti disetujui.' : 'Pengajuan cuti ditolak.');
      await refreshCore();
    });
  }

  async function reviewOvertimeRequest(row: OvertimeRequest, status: 'APPROVED' | 'REJECTED') {
    await action(async () => {
      const requestedMinutes = Math.round((new Date(row.requestedEnd).getTime() - new Date(row.requestedStart).getTime()) / 60000);
      await api(`/hr/overtime-requests/${row.id}/review`, { method: 'POST', body: JSON.stringify({ status, ...(status === 'APPROVED' ? { approvedMinutes: requestedMinutes } : {}) }) });
      setMessage(status === 'APPROVED' ? 'Pengajuan lembur disetujui.' : 'Pengajuan lembur ditolak.');
      await refreshCore();
    });
  }

  return (
    <>
      <section className="grid2">
        <Panel eyebrow="HRIS" title="Daftar Karyawan" badge={`${employees.length} orang`}>
          <Table head={['NIP', 'Nama', 'Status']} rows={employees.map((e) => [<strong>{e.employeeNumber}</strong>, e.fullName, <StatusChip status={e.isActive === false ? 'NONAKTIF' : 'AKTIF'} />])} empty="Belum ada karyawan." />
        </Panel>
        <Panel eyebrow="PAYROLL CONTROL" title="Periode & Run" badge={`${runs.length} run`}>
          <div style={{ display: 'grid', gap: 10 }}>
            <label>Periode
              <select value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)}>
                <option value="">Pilih periode</option>
                {periods.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.status}</option>)}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="secondary" disabled={busy} onClick={() => void ensureCurrentPeriod()}>Buat periode bulan ini</button>
              <button type="button" disabled={busy || !selectedPeriodId} onClick={() => void createRun()}>+ Buat Payroll Run</button>
            </div>
            <label>Tax rule APPROVED
              <select value={selectedTaxRuleId} onChange={(e) => setSelectedTaxRuleId(e.target.value)}>
                <option value="">Belum tersedia</option>
                {taxRules.filter((r) => r.status === 'APPROVED').map((r) => <option key={r.id} value={r.id}>{r.name} v{r.version}</option>)}
              </select>
            </label>
            <label>Social/BPJS rule APPROVED
              <select value={selectedSocialRuleId} onChange={(e) => setSelectedSocialRuleId(e.target.value)}>
                <option value="">Tidak digunakan / belum tersedia</option>
                {socialRules.filter((r) => r.status === 'APPROVED').map((r) => <option key={r.id} value={r.id}>{r.name} v{r.version}</option>)}
              </select>
            </label>
            {taxRules.some((r) => r.status === 'DRAFT') && !taxRules.some((r) => r.status === 'APPROVED') && <div className="notice">Tax rule masih DRAFT. Seed sengaja tidak mengaktifkan tarif pajak kosong; impor tarif resmi dan approve rule sebelum payroll production.</div>}
          </div>
        </Panel>
      </section>

      <section className="grid2">
        <Panel eyebrow="CUTI" title="Pengajuan Cuti / Izin / Sakit" badge={`${leaveRequests.filter((row) => row.status === 'SUBMITTED').length} menunggu`}>
          <Table head={['Karyawan', 'Jenis', 'Periode', 'Hari', 'Status', 'Aksi']} rows={leaveRequests.map((row) => {
            const leaveType = leaveTypes.find((item) => item.id === row.leaveTypeId);
            return [employeeById.get(row.employeeId)?.fullName ?? row.employeeId, leaveType?.name ?? row.leaveTypeId, `${tanggal(row.startDate)} – ${tanggal(row.endDate)}`, String(row.totalDays), <StatusChip status={row.status} />, row.status === 'SUBMITTED' ? <span style={{ display: 'flex', gap: 5 }}><button type="button" disabled={busy} onClick={() => void reviewLeaveRequest(row.id, 'APPROVED')}>Approve</button><button type="button" className="secondary" disabled={busy} onClick={() => void reviewLeaveRequest(row.id, 'REJECTED')}>Reject</button></span> : '-'];
          })} empty="Belum ada pengajuan cuti, izin, atau sakit." />
        </Panel>
        <Panel eyebrow="LEMBUR" title="Pengajuan Lembur" badge={`${overtimeRequests.filter((row) => row.status === 'SUBMITTED').length} menunggu`}>
          <Table head={['Karyawan', 'Waktu', 'Durasi', 'Status', 'Aksi']} rows={overtimeRequests.map((row) => {
            const minutes = Math.round((new Date(row.requestedEnd).getTime() - new Date(row.requestedStart).getTime()) / 60000);
            return [employeeById.get(row.employeeId)?.fullName ?? row.employeeId, `${new Date(row.requestedStart).toLocaleString('id-ID')} – ${new Date(row.requestedEnd).toLocaleString('id-ID')}`, `${row.approvedMinutes ?? minutes} menit`, <StatusChip status={row.status} />, row.status === 'SUBMITTED' ? <span style={{ display: 'flex', gap: 5 }}><button type="button" disabled={busy} onClick={() => void reviewOvertimeRequest(row, 'APPROVED')}>Approve</button><button type="button" className="secondary" disabled={busy} onClick={() => void reviewOvertimeRequest(row, 'REJECTED')}>Reject</button></span> : '-'];
          })} empty="Belum ada pengajuan lembur." />
        </Panel>
      </section>

      <Panel eyebrow="PAYROLL LIFECYCLE" title="Run Aktif" badge={selectedRun?.status ?? 'BELUM DIPILIH'}>
        <label style={{ display: 'block', marginBottom: 12 }}>Payroll Run
          <select value={selectedRunId} onChange={(e) => setSelectedRunId(e.target.value)}>
            <option value="">Pilih run</option>
            {runs.map((run) => <option key={run.id} value={run.id}>{run.adjustmentOfRunId ? `ADJ#${run.adjustmentSequence ?? '?'} · ` : ''}{run.number} · {run.status}</option>)}
          </select>
        </label>
        {selectedRun && <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {!selectedRun.adjustmentOfRunId && <button type="button" className="secondary" disabled={busy || !['DRAFT', 'REVIEW'].includes(selectedRun.status)} onClick={() => void lockAttendance()}>1. Kunci absensi</button>}
            <button type="button" className="secondary" disabled={busy || !['DRAFT', 'REVIEW'].includes(selectedRun.status)} onClick={() => void runStep(`/payroll/runs/${selectedRun.id}/calculate`, selectedRun.adjustmentOfRunId ? 'Adjustment selesai dihitung sebagai selisih; periksa hasil REVIEW.' : 'Payroll selesai dihitung; periksa hasil REVIEW.')}>{selectedRun.adjustmentOfRunId ? '2. Hitung selisih' : '2. Hitung'}</button>
            <button type="button" className="secondary" disabled={busy || selectedRun.status !== 'REVIEW'} onClick={() => void runStep(`/payroll/runs/${selectedRun.id}/approve`, selectedRun.adjustmentOfRunId ? 'Adjustment payroll berhasil disetujui.' : 'Payroll berhasil disetujui.')}>3. Approve</button>
            <button type="button" disabled={busy || selectedRun.status !== 'APPROVED'} onClick={() => void runStep(`/payroll/runs/${selectedRun.id}/post-accounting`, selectedRun.adjustmentOfRunId ? 'Selisih adjustment diposting tanpa mengulang jurnal payroll sumber.' : 'Payroll diposting; Utang Gaji/Pajak/BPJS sudah terbentuk.')}>{selectedRun.adjustmentOfRunId ? '4. Posting selisih' : '4. Posting jurnal'}</button>
            <button type="button" disabled={busy || selectedRun.status !== 'PAID'} onClick={() => void runStep(`/payroll/runs/${selectedRun.id}/publish-payslips`, selectedRun.adjustmentOfRunId ? 'Payslip adjustment diterbitkan melalui secure link.' : 'Payslip diterbitkan melalui secure link.')}>6. Terbitkan payslip</button>
            {!selectedRun.adjustmentOfRunId && ['POSTED', 'PAID'].includes(selectedRun.status) && <button type="button" className="secondary" disabled={busy} onClick={() => { setAdjustmentSource(selectedRun); setAdjustmentReason(''); setAdjustmentPostingDate(new Date().toLocaleDateString('en-CA')); }}>Buat adjustment</button>}
            {['DRAFT', 'REVIEW', 'APPROVED'].includes(selectedRun.status) && <button type="button" className="secondary" disabled={busy} onClick={() => { setCancelTarget(selectedRun); setCancelReason(''); }}>{selectedRun.adjustmentOfRunId ? 'Batalkan adjustment' : 'Batalkan run'}</button>}
          </div>
          {selectedRun.adjustmentOfRunId && <div className="notice" style={{ marginBottom: 12 }}>Adjustment #{selectedRun.adjustmentSequence ?? '-'} · sumber {runs.find((item) => item.id === selectedRun.adjustmentOfRunId)?.number ?? selectedRun.adjustmentOfRunId}. Nilai di bawah adalah <strong>selisih</strong>, bukan total payroll ulang. {selectedRun.adjustmentReason ? `Alasan: ${selectedRun.adjustmentReason}` : ''}</div>}
          <Table
            head={['Karyawan', 'Gross', 'Taxable', 'PPh', 'Iuran', 'Net', 'Status']}
            rows={results.map((r) => [
              employeeById.get(r.employeeId)?.fullName ?? r.employeeId,
              rupiah(Number(r.grossPay)), rupiah(Number(r.taxableIncome)), rupiah(Number(r.incomeTax)), rupiah(Number(r.employeeContribution)), <strong>{rupiah(Number(r.netPay))}</strong>, <StatusChip status={r.status} />,
            ])}
            empty="Belum ada hasil kalkulasi."
          />
        </>}
      </Panel>

      <section className="grid2">
        <Panel eyebrow="5A. PEMBAYARAN GAJI" title="Payroll Payments" badge={`${payments.filter((p) => p.status !== 'PAID').length} belum selesai`}>
          <Table
            head={['Karyawan', 'Arah', 'Nominal', 'Status', 'Aksi']}
            rows={payments.map((p) => [
              employeeById.get(p.employeeId)?.fullName ?? p.employeeId,
              p.direction === 'RECOVERY' ? 'Recovery ke perusahaan' : 'Bayar ke karyawan',
              rupiah(Number(p.amount)),
              <StatusChip status={p.status} />,
              p.status === 'PAID' ? tanggal(p.paidAt ?? '') : p.status === 'CANCELLED' ? 'Dikoreksi adjustment' : <button type="button" className="secondary" disabled={busy} onClick={() => { setSettleTarget(p); setSettlementReference(''); }}>{p.direction === 'RECOVERY' ? 'Konfirmasi penerimaan' : 'Konfirmasi transfer bank'}</button>,
            ])}
            empty="Payment/recovery akan dibuat setelah payroll diposting."
          />
          {selectedLiability?.recovery && Number(selectedLiability.recovery.recognized) > 0 && <div className="notice" style={{ marginTop: 10 }}>Piutang recovery karyawan: {rupiah(Number(selectedLiability.recovery.outstanding))} belum diterima dari {rupiah(Number(selectedLiability.recovery.recognized))} yang diakui.</div>}
        </Panel>
        <Panel eyebrow="5B. KEWAJIBAN PAYROLL" title="PPh / BPJS / Potongan" badge={selectedLiability ? 'Run terpilih' : 'Belum tersedia'}>
          {selectedLiability ? <Table
            head={['Kewajiban', 'Diakui', 'Dibayar', 'Pending', 'Sisa', 'Aksi']}
            rows={([
              ['PPh payroll (2103)', selectedLiability.tax, '2103'],
              ['BPJS/potongan (2104)', selectedLiability.socialAndOther, '2104'],
            ] satisfies Array<[string, LiabilityBucket, '2103' | '2104']>).map(([label, data, code]) => {
              const available = Number(data.availableToPay ?? 0);
              return [label, rupiah(Number(data.recognized)), rupiah(Number(data.paid)), rupiah(Number(data.pending)), <strong>{rupiah(Number(data.outstanding))}</strong>, available > 0 ? <button type="button" className="secondary" disabled={busy} onClick={() => void createLiabilityDraft(code, available)}>Buat draft bayar</button> : '-'];
            })}
          /> : <div className="notice">Posting payroll terlebih dahulu untuk membentuk kewajiban.</div>}
        </Panel>
      </section>

      <Panel eyebrow="AUDIT" title="Riwayat Payroll Runs" badge={`${runs.length} run`}>
        <Table
          head={['Nomor', 'Jenis', 'Status', 'Karyawan', 'Gross', 'PPh', 'Net', 'Dibuat']}
          rows={runs.map((r) => [<strong>{r.number}</strong>, r.adjustmentOfRunId ? `Adjustment #${r.adjustmentSequence ?? '-'}` : 'Regular', <StatusChip status={r.status} />, r.employeeCount, rupiah(Number(r.grossTotal)), rupiah(Number(r.taxTotal)), <strong>{rupiah(Number(r.netTotal))}</strong>, tanggal(r.createdAt)])}
          empty="Belum ada payroll run."
        />
        {message && <div className="notice" style={{ marginTop: 12 }}>{message}</div>}
      </Panel>

      {cancelTarget && <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="payroll-cancel-title">
        <div className="modalCard">
          <span className="eyebrow">CANCEL PRE-POSTING</span>
          <h2 id="payroll-cancel-title">Batalkan {cancelTarget.number}</h2>
          <p className="sectionHelp">Hanya run DRAFT/REVIEW/APPROVED yang belum diposting yang dapat dibatalkan. Run POSTED/PAID tidak pernah diedit atau dibatalkan dari workflow ini.</p>
          <label>Alasan pembatalan<textarea autoFocus rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Contoh: rule payroll perlu diperbaiki sebelum adjustment dihitung ulang" /></label>
          <div className="modalActions">
            <button type="button" className="secondary" disabled={busy} onClick={() => { setCancelTarget(null); setCancelReason(''); }}>Kembali</button>
            <button type="button" disabled={busy || cancelReason.trim().length < 5} onClick={() => void cancelPayrollRun()}>{busy ? 'Memproses…' : 'Batalkan run'}</button>
          </div>
        </div>
      </div>}

      {adjustmentSource && <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="payroll-adjustment-title">
        <div className="modalCard">
          <span className="eyebrow">PAYROLL ADJUSTMENT</span>
          <h2 id="payroll-adjustment-title">Koreksi {adjustmentSource.number}</h2>
          <p className="sectionHelp">Run sumber tidak diubah. Sistem membuat run baru dan menghitung selisih terhadap payroll sumber + adjustment sebelumnya yang sudah diposting.</p>
          <label>Alasan koreksi<textarea autoFocus rows={3} value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} placeholder="Contoh: koreksi lembur yang baru disetujui setelah payroll diposting" /></label>
          <label>Tanggal posting jurnal adjustment<input type="date" value={adjustmentPostingDate} onChange={(e) => setAdjustmentPostingDate(e.target.value)} /></label>
          <div className="notice">Tarif PPh/BPJS tidak dibuat otomatis. Adjustment mewarisi rule APPROVED dari payroll sumber kecuali backend diberi rule pengganti yang valid.</div>
          <div className="modalActions">
            <button type="button" className="secondary" disabled={busy} onClick={() => { setAdjustmentSource(null); setAdjustmentReason(''); }}>Batal</button>
            <button type="button" disabled={busy || adjustmentReason.trim().length < 5 || !adjustmentPostingDate} onClick={() => void createAdjustmentRun()}>{busy ? 'Memproses…' : 'Buat adjustment'}</button>
          </div>
        </div>
      </div>}

      {settleTarget && <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="payroll-settlement-title">
        <div className="modalCard">
          <span className="eyebrow">PAYROLL SETTLEMENT</span>
          <h2 id="payroll-settlement-title">{settleTarget.direction === 'RECOVERY' ? 'Konfirmasi penerimaan recovery' : 'Konfirmasi transfer gaji'}</h2>
          <p className="sectionHelp">Masukkan referensi bank hanya setelah transaksi eksternal benar-benar berhasil. {settleTarget.direction === 'RECOVERY' ? 'Nilai yang diterima kembali' : 'Nilai pembayaran'}: {rupiah(Number(settleTarget.amount))}.</p>
          <label>Referensi transfer bank<input autoFocus value={settlementReference} onChange={(e) => setSettlementReference(e.target.value)} placeholder="Nomor referensi / transaction ID" /></label>
          <div className="modalActions">
            <button type="button" className="secondary" disabled={busy} onClick={() => { setSettleTarget(null); setSettlementReference(''); }}>Kembali</button>
            <button type="button" disabled={busy || !settlementReference.trim()} onClick={() => void settleSalary(settleTarget, settlementReference)}>{busy ? 'Memproses…' : settleTarget.direction === 'RECOVERY' ? 'Konfirmasi penerimaan' : 'Konfirmasi transfer'}</button>
          </div>
        </div>
      </div>}
    </>
  );
}
