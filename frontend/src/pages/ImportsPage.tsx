import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  importTransactionsCsv,
  isApiError,
  listAccounts,
  type AccountResponse,
  type CsvImportColumnMapping,
  type CsvImportDefaultType,
  type CsvImportMappingPayload,
  type CsvImportResultResponse
} from '../api';

type CsvPreview = {
  headers: string[];
  rows: string[][];
  accountValues: string[];
};

type MappingState = CsvImportColumnMapping;

const HEADER_MATCHERS: Record<keyof MappingState, RegExp[]> = {
  txDate: [/^date$/i, /tx[_ ]?date/i, /거래일/i, /일자/i],
  amount: [/^amount$/i, /금액/i, /거래금액/i],
  description: [/^description$/i, /memo/i, /적요/i, /내용/i],
  account: [/^account$/i, /계좌/i, /account name/i],
  type: [/^type$/i, /구분/i, /거래유형/i]
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function guessHeader(headers: string[], field: keyof MappingState): string {
  for (const header of headers) {
    if (HEADER_MATCHERS[field].some((pattern) => pattern.test(header))) {
      return header;
    }
  }
  return '';
}

function parseCsvText(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  const text = content.startsWith('\uFEFF') ? content.slice(1) : content;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (ch === '"') {
      if (inQuotes && i + 1 < text.length && text[i + 1] === '"') {
        currentCell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
        i += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += ch;
  }

  if (currentRow.length > 0 || currentCell.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim() !== ''));
}

export default function ImportsPage() {
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [mapping, setMapping] = useState<MappingState>({
    txDate: '',
    amount: '',
    description: '',
    account: '',
    type: ''
  });
  const [defaultType, setDefaultType] = useState<CsvImportDefaultType>('EXPENSE');
  const [accountNameMap, setAccountNameMap] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CsvImportResultResponse | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [parsingFile, setParsingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    async function loadAccounts() {
      setLoadingAccounts(true);
      try {
        const res = await listAccounts();
        if (!active) return;
        setAccounts(res.items.filter((account) => account.isActive));
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load accounts.');
      } finally {
        if (active) setLoadingAccounts(false);
      }
    }

    void loadAccounts();
    return () => {
      active = false;
    };
  }, []);

  const accountNameByNormalized = useMemo(() => {
    const map = new Map<string, AccountResponse>();
    for (const account of accounts) {
      map.set(normalize(account.name), account);
    }
    return map;
  }, [accounts]);

  const missingAccountMappings = useMemo(() => {
    if (!preview) return 0;
    return preview.accountValues.filter((value) => !accountNameMap[value]).length;
  }, [preview, accountNameMap]);

  const mappingReady = file != null
    && preview != null
    && mapping.txDate
    && mapping.amount
    && mapping.description
    && mapping.account
    && missingAccountMappings === 0;

  const submitHint = (() => {
    if (loadingAccounts) return 'Loading active accounts...';
    if (!file || !preview) return 'Upload a CSV file to enable import.';
    if (!mapping.txDate || !mapping.amount || !mapping.description || !mapping.account) {
      return 'Map every required column to continue.';
    }
    if (missingAccountMappings > 0) {
      return 'Map every CSV account name to an active account.';
    }
    return 'Ready to import.';
  })();

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setPreview(null);
    setResult(null);
    setError('');
    setFieldErrors({});

    if (!nextFile) {
      return;
    }

    setParsingFile(true);
    try {
      const text = await nextFile.text();
      const rows = parseCsvText(text);
      if (rows.length < 2) {
        throw new Error('CSV must contain a header row and at least one data row.');
      }

      const headers = rows[0].map((header) => header.trim());
      const previewRows = rows.slice(1, 6);
      const accountHeader = guessHeader(headers, 'account');
      const accountIndex = headers.findIndex((header) => header === accountHeader);
      const accountValues = accountIndex >= 0
        ? Array.from(new Set(rows.slice(1).map((row) => row[accountIndex] ?? '').map((value) => value.trim()).filter(Boolean)))
        : [];

      setPreview({
        headers,
        rows: previewRows,
        accountValues
      });

      const nextMapping: MappingState = {
        txDate: guessHeader(headers, 'txDate'),
        amount: guessHeader(headers, 'amount'),
        description: guessHeader(headers, 'description'),
        account: accountHeader,
        type: guessHeader(headers, 'type')
      };
      setMapping(nextMapping);

      const nextAccountMap: Record<string, string> = {};
      for (const value of accountValues) {
        const matched = accountNameByNormalized.get(normalize(value));
        if (matched) {
          nextAccountMap[value] = String(matched.id);
        }
      }
      setAccountNameMap(nextAccountMap);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file.');
    } finally {
      setParsingFile(false);
    }
  };

  const updateMapping = (field: keyof MappingState, value: string) => {
    setMapping((prev) => ({ ...prev, [field]: value }));
  };

  const updateAccountMap = (csvAccountName: string, value: string) => {
    setAccountNameMap((prev) => ({ ...prev, [csvAccountName]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !preview) return;

    setSubmitting(true);
    setError('');
    setFieldErrors({});
    setResult(null);

    try {
      const payload: CsvImportMappingPayload = {
        columns: {
          txDate: mapping.txDate,
          amount: mapping.amount,
          description: mapping.description,
          account: mapping.account,
          ...(mapping.type ? { type: mapping.type } : {})
        },
        accountNameMap: Object.fromEntries(
          preview.accountValues.map((value) => [value, Number(accountNameMap[value])])
        ),
        defaultType
      };

      const response = await importTransactionsCsv(file, payload);
      setResult(response);
    } catch (err: unknown) {
      if (isApiError(err) && err.fieldErrors) {
        const next: Record<string, string> = {};
        for (const fieldError of err.fieldErrors) {
          if (!next[fieldError.field]) next[fieldError.field] = fieldError.reason;
        }
        setFieldErrors(next);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Import failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container imports-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">CSV IMPORT</h1>
          <p className="hint">1-shot import with row validation, duplicate skip, and atomic save.</p>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="imports-layout">
        <form className="card" onSubmit={handleSubmit}>
          <div className="imports-card-header">
            <div>
              <h3>Upload and Mapping</h3>
              <p className="hint">Supported scope: `INCOME` and `EXPENSE` only. `TRANSFER` CSV rows are rejected in this MVP.</p>
            </div>
          </div>

          <label className="field">
            <span>CSV File</span>
            <input type="file" accept=".csv,text/csv" onChange={handleFileChange} />
            {parsingFile ? <span className="hint">Parsing file...</span> : null}
            {fieldErrors.file ? <span className="hint error">{fieldErrors.file}</span> : null}
          </label>

          {preview ? (
            <>
              <div className="imports-note-grid">
                <div className="card import-subcard">
                  <h4>Detected Headers</h4>
                  <div className="chip-group">
                    {preview.headers.map((header) => (
                      <span key={header} className="chip chip-static">{header}</span>
                    ))}
                  </div>
                </div>
                <div className="card import-subcard">
                  <h4>Import Defaults</h4>
                  <label className="field">
                    <span>Default Type</span>
                    <select value={defaultType} onChange={(e) => setDefaultType(e.target.value as CsvImportDefaultType)}>
                      <option value="EXPENSE">EXPENSE</option>
                      <option value="INCOME">INCOME</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="grid-two">
                <label className="field">
                  <span>Date Column</span>
                  <select value={mapping.txDate} onChange={(e) => updateMapping('txDate', e.target.value)}>
                    <option value="">Select header</option>
                    {preview.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                  {fieldErrors['mapping.columns.txDate'] ? <span className="hint error">{fieldErrors['mapping.columns.txDate']}</span> : null}
                </label>
                <label className="field">
                  <span>Amount Column</span>
                  <select value={mapping.amount} onChange={(e) => updateMapping('amount', e.target.value)}>
                    <option value="">Select header</option>
                    {preview.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                  {fieldErrors['mapping.columns.amount'] ? <span className="hint error">{fieldErrors['mapping.columns.amount']}</span> : null}
                </label>
                <label className="field">
                  <span>Description Column</span>
                  <select value={mapping.description} onChange={(e) => updateMapping('description', e.target.value)}>
                    <option value="">Select header</option>
                    {preview.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                  {fieldErrors['mapping.columns.description'] ? <span className="hint error">{fieldErrors['mapping.columns.description']}</span> : null}
                </label>
                <label className="field">
                  <span>Account Column</span>
                  <select value={mapping.account} onChange={(e) => updateMapping('account', e.target.value)}>
                    <option value="">Select header</option>
                    {preview.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                  {fieldErrors['mapping.columns.account'] ? <span className="hint error">{fieldErrors['mapping.columns.account']}</span> : null}
                </label>
              </div>

              <label className="field">
                <span>Type Column (optional)</span>
                <select value={mapping.type ?? ''} onChange={(e) => updateMapping('type', e.target.value)}>
                  <option value="">Use default type / sign inference</option>
                  {preview.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                </select>
                {fieldErrors['mapping.columns.type'] ? <span className="hint error">{fieldErrors['mapping.columns.type']}</span> : null}
              </label>

              <div className="card import-subcard">
                <h4>CSV Account Mapping</h4>
                {preview.accountValues.length === 0 ? (
                  <p className="hint">No account values detected yet.</p>
                ) : (
                  <div className="account-map-list">
                    {preview.accountValues.map((value) => (
                      <label key={value} className="field-inline account-map-row">
                        <span>{value}</span>
                        <select value={accountNameMap[value] ?? ''} onChange={(e) => updateAccountMap(value, e.target.value)}>
                          <option value="">Map to account</option>
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>{account.name}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                )}
                {missingAccountMappings > 0 ? <p className="hint error">{missingAccountMappings} account mapping(s) still missing.</p> : null}
                {fieldErrors['mapping.accountNameMap'] ? <p className="hint error">{fieldErrors['mapping.accountNameMap']}</p> : null}
              </div>

              <div className="card import-subcard">
                <h4>Preview</h4>
                <div className="imports-preview-table">
                  <table className="flat-table">
                    <thead>
                      <tr>
                        {preview.headers.map((header) => <th key={header}>{header}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, index) => (
                        <tr key={`${index}-${row.join('|')}`}>
                          {preview.headers.map((_, cellIndex) => <td key={`${index}-${cellIndex}`}>{row[cellIndex] ?? ''}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="card import-subcard import-empty-state">
              <h4>Before You Import</h4>
              <p className="hint">Upload a UTF-8 CSV with headers to auto-detect columns and map account names before saving.</p>
            </div>
          )}

          <p className={mappingReady ? 'hint text-cyan' : 'hint'}>{submitHint}</p>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={!mappingReady || submitting || loadingAccounts}>
              {submitting ? 'IMPORTING...' : 'RUN IMPORT'}
            </button>
          </div>
        </form>

        <div className="imports-side-column">
          <div className="card">
            <h3>Rules</h3>
            <ul className="flat-list">
              <li className="list-item">If any row fails validation, the full import is rolled back.</li>
              <li className="list-item">Duplicate detection uses `date + type + amount + account + normalized description`.</li>
              <li className="list-item">Imported rows are saved without a category and move into inbox review (`needsReview=true`).</li>
              <li className="list-item">The import source is stored automatically as `source=CSV`.</li>
            </ul>
          </div>

          <div className="card">
            <h3>Accounts</h3>
            {loadingAccounts ? <p className="hint">Loading accounts...</p> : null}
            {!loadingAccounts && accounts.length === 0 ? <p className="hint">Create an active account before importing.</p> : null}
            {!loadingAccounts && accounts.length > 0 ? (
              <ul className="flat-list">
                {accounts.map((account) => (
                  <li key={account.id} className="list-item">{account.name}</li>
                ))}
              </ul>
            ) : null}
          </div>

          {result ? (
            <div className="card import-result-card">
              <h3>Import Result</h3>
              <div className="dashboard-grid import-result-grid">
                <div className="card import-subcard">
                  <h4>Created</h4>
                  <p>{result.createdCount}</p>
                </div>
                <div className="card import-subcard">
                  <h4>Skipped</h4>
                  <p>{result.skippedCount}</p>
                </div>
                <div className="card import-subcard">
                  <h4>Warnings</h4>
                  <p>{result.warningCount}</p>
                </div>
              </div>
              {result.warnings && result.warnings.length > 0 ? (
                <ul className="flat-list warning-list">
                  {result.warnings.map((warning) => (
                    <li key={`${warning.row}-${warning.code}`} className="list-item">
                      <strong>Row {warning.row}</strong> · {warning.code} · {warning.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="hint">No warnings. Imported rows were saved atomically.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
