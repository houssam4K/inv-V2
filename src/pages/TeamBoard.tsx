import * as React from "react"
import { MessageSquare, Plus, Trash2, Edit2, Check, X, Truck, Calendar, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { supabase } from "@/lib/supabase"
import type { Note, ExpectedShipment } from "@/lib/types"

const NOTE_COLORS = [
  "bg-yellow-100 border-yellow-200 dark:bg-yellow-900/40 dark:border-yellow-800/50",
  "bg-blue-100 border-blue-200 dark:bg-blue-900/40 dark:border-blue-800/50",
  "bg-emerald-100 border-emerald-200 dark:bg-emerald-900/40 dark:border-emerald-800/50",
  "bg-rose-100 border-rose-200 dark:bg-rose-900/40 dark:border-rose-800/50",
  "bg-purple-100 border-purple-200 dark:bg-purple-900/40 dark:border-purple-800/50",
]

export function TeamBoard() {
  const [notes, setNotes] = React.useState<Note[]>([])
  const [shipments, setShipments] = React.useState<ExpectedShipment[]>([])
  const [loading, setLoading] = React.useState(true)
  
  // Note state
  const [isAddingNote, setIsAddingNote] = React.useState(false)
  const [newContent, setNewContent] = React.useState("")
  const [newAuthor, setNewAuthor] = React.useState("")
  const [newColor, setNewColor] = React.useState(NOTE_COLORS[0])
  const [editingId, setEditingId] = React.useState<string | null>(null)

  // Shipment state
  const [isAddingShipment, setIsAddingShipment] = React.useState(false)
  const [newSupplier, setNewSupplier] = React.useState("")
  const [newDesc, setNewDesc] = React.useState("")
  const [newDate, setNewDate] = React.useState("")

  const loadData = React.useCallback(async () => {
    setLoading(true)
    const [notesRes, shipRes] = await Promise.all([
      supabase.from("notes").select("*").order("created_at", { ascending: false }),
      supabase.from("expected_shipments").select("*").eq("status", "pending").order("expected_date", { ascending: true })
    ])
    
    if (!notesRes.error && notesRes.data) setNotes(notesRes.data)
    if (!shipRes.error && shipRes.data) setShipments(shipRes.data)
    
    setLoading(false)
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  // --- Notes Functions ---
  async function handleAddNote() {
    if (!newContent.trim()) return
    const { data, error } = await supabase
      .from("notes")
      .insert({ content: newContent, author: newAuthor.trim() || null, color: newColor })
      .select().single()
    if (!error && data) {
      setNotes([data, ...notes])
      setIsAddingNote(false)
      setNewContent("")
      setNewAuthor("")
      setNewColor(NOTE_COLORS[0])
    }
  }

  async function handleDeleteNote(id: string) {
    const { error } = await supabase.from("notes").delete().eq("id", id)
    if (!error) setNotes(notes.filter(n => n.id !== id))
  }

  async function handleUpdateNote(id: string, updatedContent: string) {
    if (!updatedContent.trim()) return
    const { error } = await supabase.from("notes").update({ content: updatedContent }).eq("id", id)
    if (!error) {
      setNotes(notes.map(n => n.id === id ? { ...n, content: updatedContent } : n))
      setEditingId(null)
    }
  }

  // --- Shipments Functions ---
  async function handleAddShipment() {
    if (!newSupplier.trim() || !newDesc.trim() || !newDate) return
    const { data, error } = await supabase
      .from("expected_shipments")
      .insert({ supplier_name: newSupplier, description: newDesc, expected_date: newDate })
      .select().single()
    if (!error && data) {
      setShipments([...shipments, data].sort((a, b) => new Date(a.expected_date).getTime() - new Date(b.expected_date).getTime()))
      setIsAddingShipment(false)
      setNewSupplier("")
      setNewDesc("")
      setNewDate("")
    }
  }

  async function handleMarkShipmentArrived(id: string) {
    const { error } = await supabase.from("expected_shipments").update({ status: "arrived" }).eq("id", id)
    if (!error) setShipments(shipments.filter(s => s.id !== id))
  }

  async function handleDeleteShipment(id: string) {
    const { error } = await supabase.from("expected_shipments").delete().eq("id", id)
    if (!error) setShipments(shipments.filter(s => s.id !== id))
  }

  return (
    <div className="flex flex-col gap-8 p-6 max-w-6xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <MessageSquare className="size-8 text-primary" />
        <div>
          <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">Team Board</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Coordinate with your team, track expected deliveries, and leave notes.
          </p>
        </div>
      </div>

      {/* --- EXPECTED SHIPMENTS SECTION --- */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Truck className="size-5 text-blue-500" />
            Expected Shipments
          </h2>
          <Button onClick={() => setIsAddingShipment(true)} variant="outline" size="sm" className="gap-2">
            <Plus className="size-4" /> Add Expected
          </Button>
        </div>

        {isAddingShipment && (
          <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-3 flex-wrap animate-in fade-in slide-in-from-top-2">
            <Input 
              placeholder="Supplier Name (e.g. Plastipak)" 
              value={newSupplier}
              onChange={e => setNewSupplier(e.target.value)}
              className="w-full sm:w-auto flex-1"
            />
            <Input 
              placeholder="Description (e.g. 2 pallets 1.5L preforms)" 
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="w-full sm:w-auto flex-2 min-w-[250px]"
            />
            <Input 
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="w-full sm:w-auto flex-1"
            />
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button variant="ghost" onClick={() => setIsAddingShipment(false)}>Cancel</Button>
              <Button onClick={handleAddShipment} disabled={!newSupplier || !newDesc || !newDate}>Save</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="h-32 rounded-xl bg-muted/50 animate-pulse border" />
        ) : shipments.length === 0 && !isAddingShipment ? (
          <div className="rounded-xl border border-dashed bg-card/50 p-8 text-center flex flex-col items-center gap-2">
            <Calendar className="size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No upcoming shipments expected.</p>
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipments.map(ship => {
                  const isToday = ship.expected_date === new Date().toISOString().split('T')[0]
                  const isOverdue = new Date(ship.expected_date) < new Date(new Date().setHours(0,0,0,0))
                  return (
                    <TableRow key={ship.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {new Date(ship.expected_date).toLocaleDateString('fr-DZ')}
                      </TableCell>
                      <TableCell className="font-semibold">{ship.supplier_name}</TableCell>
                      <TableCell>{ship.description}</TableCell>
                      <TableCell>
                        {isOverdue ? (
                          <Badge variant="destructive">Overdue</Badge>
                        ) : isToday ? (
                          <Badge className="bg-amber-500 hover:bg-amber-600">Today</Badge>
                        ) : (
                          <Badge variant="outline" className="text-blue-500 border-blue-200 bg-blue-50 dark:bg-blue-900/20">Upcoming</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                            onClick={() => handleMarkShipmentArrived(ship.id)}
                            title="Mark as Arrived"
                          >
                            <CheckCircle2 className="size-3.5" /> Arrived
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteShipment(ship.id)}
                            title="Delete"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* --- NOTES SECTION --- */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-t pt-8">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MessageSquare className="size-5 text-yellow-500" />
            Sticky Notes
          </h2>
          <Button onClick={() => setIsAddingNote(true)} variant="outline" size="sm" className="gap-2">
            <Plus className="size-4" /> Add Note
          </Button>
        </div>

        {isAddingNote && (
          <div className="rounded-xl border bg-card p-5 shadow-sm flex flex-col gap-4 animate-in fade-in slide-in-from-top-4">
            <Textarea 
              placeholder="Write your note here..." 
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              className="min-h-[100px] resize-none text-base"
              autoFocus
            />
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <Input 
                  placeholder="Your Name (Optional)" 
                  value={newAuthor}
                  onChange={e => setNewAuthor(e.target.value)}
                  className="max-w-[200px]"
                />
                <div className="flex gap-1.5">
                  {NOTE_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={`size-6 rounded-full border-2 ${c.split(' ')[0]} ${newColor === c ? 'border-primary ring-2 ring-primary/20 ring-offset-1' : 'border-transparent'}`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setIsAddingNote(false)}>Cancel</Button>
                <Button onClick={handleAddNote} disabled={!newContent.trim()}>Post Note</Button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-40 rounded-xl bg-muted/50 animate-pulse border" />)}
          </div>
        ) : notes.length === 0 && !isAddingNote ? (
          <div className="rounded-xl border border-dashed bg-card/50 p-8 text-center flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground">No notes on the board.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
            {notes.map(note => (
              <div key={note.id} className={`relative group rounded-xl p-5 shadow-sm border flex flex-col gap-3 transition-all hover:shadow-md ${note.color}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                    {note.author ? note.author : "Team Note"}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditingId(note.id)} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded" title="Edit Note">
                      <Edit2 className="size-3.5" />
                    </button>
                    <button onClick={() => handleDeleteNote(note.id)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="Delete Note">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                
                {editingId === note.id ? (
                  <div className="flex flex-col gap-2">
                    <Textarea 
                      defaultValue={note.content}
                      id={`edit-${note.id}`}
                      className="min-h-[100px] resize-none text-base bg-white/50 dark:bg-black/20 border-black/10 dark:border-white/10 focus-visible:ring-1"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-7 h-7" onClick={() => setEditingId(null)}>
                        <X className="size-3.5" />
                      </Button>
                      <Button 
                        variant="secondary" size="icon" className="size-7 h-7"
                        onClick={() => handleUpdateNote(note.id, (document.getElementById(`edit-${note.id}`) as HTMLTextAreaElement).value)}
                      >
                        <Check className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{note.content}</div>
                )}
                
                <div className="mt-auto pt-3 text-[10px] text-muted-foreground/60 text-right font-medium">
                  {new Date(note.created_at).toLocaleString("fr-DZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
