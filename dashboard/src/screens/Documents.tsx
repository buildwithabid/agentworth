import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchDocuments } from '../lib/data'
import { nameOf, useSession } from '../lib/session'
import type { DocumentFile } from '../lib/types'
import { fileSize, shortDate } from '../lib/format'
import {
  Avatar,
  Button,
  Empty,
  ErrorBanner,
  LoadingScreen,
  PageHeader,
  useToast,
} from '../components/ui'
import { IconOpen, IconTrash, IconUpload } from '../components/icons'

const MAX_BYTES = 25 * 1024 * 1024

/**
 * Store each file under its own folder: `<uuid>/<original name>`. Two people
 * uploading "scan.pdf" don't collide, and the name they chose survives intact
 * rather than being mangled into the key.
 */
function storageKey(fileName: string): string {
  const cleaned = fileName
    .normalize('NFKD')
    .replace(/[/\\]+/g, '-')
    .replace(/[^\w.\- ()]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150)
  return `${crypto.randomUUID()}/${cleaned || 'file'}`
}

/** Show the name people gave the file, not the folder it is stored under. */
function displayName(key: string): string {
  const slash = key.indexOf('/')
  return slash === -1 ? key : key.slice(slash + 1)
}

export default function Documents() {
  const { me, team, isAdmin } = useSession()
  const toast = useToast()
  const [files, setFiles] = useState<DocumentFile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      setFiles(await fetchDocuments())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function upload(list: FileList | null) {
    if (!list || list.length === 0) return
    setBusy(true)
    let ok = 0
    for (const file of Array.from(list)) {
      if (file.size > MAX_BYTES) {
        toast.bad(`${file.name} is ${fileSize(file.size)} — the limit is 25 MB`)
        continue
      }
      const { error } = await supabase.storage
        .from('documents')
        .upload(storageKey(file.name), file, { contentType: file.type || undefined })
      if (error) toast.bad(`${file.name}: ${error.message}`)
      else ok++
    }
    setBusy(false)
    if (ok > 0) toast.ok(ok === 1 ? 'Uploaded' : `${ok} files uploaded`)
    if (input.current) input.current.value = ''
    void load()
  }

  /** Private bucket: mint a short-lived link rather than exposing the file. */
  async function open(f: DocumentFile) {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(f.name, 120)
    if (error || !data) {
      toast.bad(error?.message ?? 'Could not open that file')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function remove(f: DocumentFile) {
    if (!window.confirm(`Delete ${displayName(f.name)}? This cannot be undone.`)) return
    const { error } = await supabase.storage.from('documents').remove([f.name])
    if (error) toast.bad(error.message)
    else {
      toast.ok('Deleted')
      void load()
    }
  }

  if (error && !files) return <ErrorBanner message={error} />
  if (!files) return <LoadingScreen />

  return (
    <div>
      {error && <ErrorBanner message={error} />}

      <PageHeader
        title="Documents"
        subtitle="Shared with all three of you. The agreement, SECP and PSEB paperwork, PRCs, contracts, case studies."
        actions={
          <Button
            onClick={() => input.current?.click()}
            disabled={busy}
            icon={<IconUpload size={15} />}
          >
            {busy ? 'Uploading…' : 'Upload'}
          </Button>
        }
      />

      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => void upload(e.target.files)}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void upload(e.dataTransfer.files)
        }}
        className={`mb-5 rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
          dragging ? 'border-accent bg-accent/5' : 'border-rule'
        }`}
      >
        <IconUpload size={22} className="mx-auto mb-2.5 text-muted" />
        <p className="text-sm text-body">
          Drop files here, or{' '}
          <button
            onClick={() => input.current?.click()}
            className="font-medium text-accent underline underline-offset-2"
          >
            choose them
          </button>
        </p>
        <p className="mt-1 text-xs text-muted">Up to 25 MB each. Anyone on the team can upload.</p>
      </div>

      {files.length === 0 ? (
        <Empty
          title="Nothing uploaded yet"
          hint="Start with the signed founders' agreement, so it is somewhere all three of you can find it."
        />
      ) : (
        <ul className="space-y-2">
          {files.map((f) => {
            const mine = f.uploaded_by === me?.id
            return (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-xl border border-rule bg-card p-3.5 shadow-card transition duration-150 hover:-translate-y-px hover:shadow-lift"
              >
                <button onClick={() => void open(f)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-medium">{displayName(f.name)}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <span>{fileSize(f.size_bytes)}</span>
                    <span>·</span>
                    <span>{shortDate(f.created_at.slice(0, 10))}</span>
                    {f.uploaded_by && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar name={nameOf(team, f.uploaded_by)} you={mine} />
                          {nameOf(team, f.uploaded_by)}
                        </span>
                      </>
                    )}
                  </p>
                </button>
                <Button
                  size="sm"
                  variant="quiet"
                  onClick={() => void open(f)}
                  icon={<IconOpen size={13} />}
                >
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => void remove(f)}
                  disabled={!isAdmin && !mine}
                  disabledReason="You can delete your own uploads; Abid can delete any"
                  icon={<IconTrash size={13} />}
                  aria-label={`Delete ${displayName(f.name)}`}
                >
                  <span className="sr-only sm:not-sr-only">Delete</span>
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-5 text-xs text-muted">
        The bucket is private. Opening a file mints a link that expires after two minutes, so a
        forwarded link stops working on its own.
      </p>
    </div>
  )
}
