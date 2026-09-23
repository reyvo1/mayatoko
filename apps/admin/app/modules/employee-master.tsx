'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { authFetch } from '../auth-fetch';
import { Panel, StatusChip, Table } from '../ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

const EMPLOYMENT_STATUSES = [
  'PROBATION',
  'PERMANENT',
  'CONTRACT',
  'DAILY',
  'PART_TIME',
  'INTERN',
  'INACTIVE',
  'TERMINATED',
] as const;

type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

type Employee = {
  id: string;
  employeeNumber: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  employmentStatus: EmploymentStatus;
  hireDate: string;
  contractEnd?: string | null;
  isActive: boolean;
};

type Department = { id: string; code: string; name: string; isActive?: boolean };
type Position = { id: string; departmentId?: string | null; code: string; name: string; grade?: string | null; isActive?: boolean };
type CursorResponse<T> = { items?: T[]; nextCursor?: string | null };

type EmployeeForm = {
  employeeNumber: string;
  fullName: string;
  email: string;
  phone: string;
  departmentId: string;
  positionId: string;
  employmentStatus: EmploymentStatus;
  hireDate: string;
  contractEnd: string;
};

function initialForm(): EmployeeForm {
  return {
    employeeNumber: '',
    fullName: '',
    email: '',
    phone: '',
    departmentId: '',
    positionId: '',
    employmentStatus: 'PERMANENT',
    hireDate: new Date().toLocaleDateString('en-CA'),
    contractEnd: '',
  };
}

function rowsOf<T>(data: T[] | CursorResponse<T>): T[] {
  return Array.isArray(data) ? data : data.items ?? [];
}

function dateOnly(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : parsed.toLocaleDateString('en-CA');
}

export default function EmployeeMasterView({ token }: { token: string }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [form, setForm] = useState<EmployeeForm>(() => initialForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await authFetch(`${API}${path}`, token, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Permintaan gagal.');
    }
    return data as T;
  }

  async function refresh(searchTerm = search) {
    const query = new URLSearchParams({ limit: '100' });
    if (searchTerm.trim()) query.set('search', searchTerm.trim());
    const [employeeData, departmentData, positionData] = await Promise.all([
      api<Employee[] | CursorResponse<Employee>>(`/hr/employees?${query.toString()}`),
      api<Department[]>('/hr/departments'),
      api<Position[]>('/hr/positions'),
    ]);
    setEmployees(rowsOf(employeeData));
    setDepartments(departmentData.filter((row) => row.isActive !== false));
    setPositions(positionData.filter((row) => row.isActive !== false));
  }

  useEffect(() => {
    void refresh().catch((error) => setMessage(error instanceof Error ? error.message : 'Gagal memuat employee master.'));
  }, [token]);

  const availablePositions = useMemo(
    () => positions.filter((row) => !form.departmentId || !row.departmentId || row.departmentId === form.departmentId),
    [positions, form.departmentId],
  );

  function resetForm() {
    setEditingId(null);
    setForm(initialForm());
  }

  function startEdit(employee: Employee) {
    setEditingId(employee.id);
    setForm({
      employeeNumber: employee.employeeNumber,
      fullName: employee.fullName,
      email: employee.email ?? '',
      phone: employee.phone ?? '',
      departmentId: employee.departmentId ?? '',
      positionId: employee.positionId ?? '',
      employmentStatus: employee.employmentStatus,
      hireDate: dateOnly(employee.hireDate),
      contractEnd: dateOnly(employee.contractEnd),
    });
    setMessage('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (editingId) {
        await api<Employee>(`/hr/employees/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            fullName: form.fullName.trim(),
            email: form.email.trim() || undefined,
            phone: form.phone.trim() || undefined,
            departmentId: form.departmentId || null,
            positionId: form.positionId || null,
            employmentStatus: form.employmentStatus,
          }),
        });
        setMessage('Data karyawan berhasil diperbarui.');
      } else {
        await api<Employee>('/hr/employees', {
          method: 'POST',
          body: JSON.stringify({
            employeeNumber: form.employeeNumber.trim(),
            fullName: form.fullName.trim(),
            email: form.email.trim() || undefined,
            phone: form.phone.trim() || undefined,
            departmentId: form.departmentId || undefined,
            positionId: form.positionId || undefined,
            employmentStatus: form.employmentStatus,
            hireDate: form.hireDate,
            contractEnd: form.contractEnd || undefined,
            timezone: 'Asia/Makassar',
          }),
        });
        setMessage('Karyawan berhasil dibuat.');
      }
      resetForm();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan karyawan.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(employee: Employee) {
    setBusy(true);
    setMessage('');
    try {
      await api<Employee>(`/hr/employees/${employee.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !employee.isActive }),
      });
      if (editingId === employee.id) resetForm();
      setMessage(employee.isActive ? 'Karyawan dinonaktifkan.' : 'Karyawan diaktifkan kembali.');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal mengubah status karyawan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="grid2">
        <form className="panel" onSubmit={submit}>
          <div className="panelTitle">
            <div>
              <span className="eyebrow">EMPLOYEE MASTER</span>
              <h2>{editingId ? 'Edit karyawan' : 'Tambah karyawan'}</h2>
            </div>
            {editingId && <button type="button" className="secondary" disabled={busy} onClick={resetForm}>Batal edit</button>}
          </div>

          <label>NIP / Employee Number
            <input required disabled={Boolean(editingId)} value={form.employeeNumber} onChange={(event) => setForm({ ...form, employeeNumber: event.target.value })} />
          </label>
          <label>Nama lengkap
            <input required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
          </label>
          <div className="inline">
            <label>Email
              <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </label>
            <label>Telepon
              <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </label>
          </div>
          <div className="inline">
            <label>Department
              <select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value, positionId: '' })}>
                <option value="">Tanpa department</option>
                {departments.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}
              </select>
            </label>
            <label>Position
              <select value={form.positionId} onChange={(event) => setForm({ ...form, positionId: event.target.value })}>
                <option value="">Tanpa position</option>
                {availablePositions.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}
              </select>
            </label>
          </div>
          <label>Status kepegawaian
            <select value={form.employmentStatus} onChange={(event) => setForm({ ...form, employmentStatus: event.target.value as EmploymentStatus })}>
              {EMPLOYMENT_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
          {!editingId && <div className="inline">
            <label>Tanggal masuk
              <input type="date" required value={form.hireDate} onChange={(event) => setForm({ ...form, hireDate: event.target.value })} />
            </label>
            <label>Kontrak berakhir
              <input type="date" value={form.contractEnd} onChange={(event) => setForm({ ...form, contractEnd: event.target.value })} />
            </label>
          </div>}
          <button disabled={busy}>{busy ? 'Menyimpan…' : editingId ? 'Simpan perubahan' : 'Tambah karyawan'}</button>
        </form>

        <Panel eyebrow="TENANT-SAFE HRIS" title="Kontrol operator" badge={`${employees.filter((row) => row.isActive).length} aktif`}>
          <p className="sectionHelp">Company dan branch tidak dipilih dari form. Scope selalu berasal dari identitas login dan diverifikasi ulang oleh API.</p>
          <form onSubmit={(event) => { event.preventDefault(); void refresh().catch((error) => setMessage(error instanceof Error ? error.message : 'Pencarian gagal.')); }}>
            <label>Cari karyawan
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="NIP, nama, atau email" />
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="submit" className="secondary" disabled={busy}>Cari</button>
              <button type="button" className="secondary" disabled={busy || !search} onClick={() => { setSearch(''); void refresh(''); }}>Reset</button>
            </div>
          </form>
          {message && <div className="notice" style={{ marginTop: 12 }}>{message}</div>}
        </Panel>
      </section>

      <Panel eyebrow="HRIS" title="Daftar Karyawan" badge={`${employees.length} orang`}>
        <Table
          head={['NIP', 'Nama', 'Department', 'Position', 'Status', 'Aksi']}
          rows={employees.map((employee) => {
            const department = departments.find((row) => row.id === employee.departmentId);
            const position = positions.find((row) => row.id === employee.positionId);
            return [
              <strong>{employee.employeeNumber}</strong>,
              employee.fullName,
              department?.name ?? '-',
              position?.name ?? '-',
              <StatusChip status={employee.isActive === false ? 'NONAKTIF' : employee.employmentStatus} />,
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="secondary" disabled={busy} onClick={() => startEdit(employee)}>Edit</button>
                <button type="button" className="secondary" disabled={busy} onClick={() => void toggleActive(employee)}>{employee.isActive === false ? 'Aktifkan' : 'Nonaktifkan'}</button>
              </span>,
            ];
          })}
          empty="Belum ada karyawan pada branch ini."
        />
      </Panel>
    </>
  );
}
