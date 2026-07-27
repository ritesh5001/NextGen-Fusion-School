import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listBooks,
  saveBook,
  deleteBook,
  listIssues,
  issueBook,
  returnBook,
  deleteIssue,
} from "@/lib/library.functions";
import { listStudents } from "@/lib/students.functions";
import { listEmployees } from "@/lib/hrm.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Plus, Trash2, Pencil, ArrowLeftRight } from "lucide-react";

export const Route = createFileRoute("/app/library")({ component: LibraryPage });

type Book = {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  publisher: string | null;
  edition: string | null;
  totalCopies: number;
  availableCopies: number;
  rackNo: string | null;
  dailyFine: number;
  isActive: boolean;
};

type Issue = {
  id: string;
  bookId: string;
  bookTitle: string;
  borrowerType: "student" | "employee";
  borrowerName: string;
  issuedOn: string;
  dueDate: string;
  returnedOn: string | null;
  fineAmount: number;
  fineCollected: number;
  status: "issued" | "returned" | "overdue" | "lost";
};

function LibraryPage() {
  const listB = useServerFn(listBooks);
  const saveB = useServerFn(saveBook);
  const delB = useServerFn(deleteBook);
  const listI = useServerFn(listIssues);
  const issue = useServerFn(issueBook);
  const ret = useServerFn(returnBook);
  const delI = useServerFn(deleteIssue);
  const listStu = useServerFn(listStudents);
  const listEmp = useServerFn(listEmployees);

  const [books, setBooks] = useState<Book[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [students, setStudents] = useState<
    { id: string; admissionNo: string; firstName: string; lastName: string | null }[]
  >([]);
  const [employees, setEmployees] = useState<
    { id: string; employeeCode: string; firstName: string; lastName: string | null }[]
  >([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "issued" | "returned" | "overdue" | "lost" | "all"
  >("issued");

  const [bOpen, setBOpen] = useState(false);
  const [bEdit, setBEdit] = useState<Partial<Book> | null>(null);
  const [iOpen, setIOpen] = useState(false);
  const [iForm, setIForm] = useState({
    bookId: "",
    borrowerType: "student" as "student" | "employee",
    studentId: "",
    employeeId: "",
    issuedOn: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    note: "",
  });
  const [rOpen, setROpen] = useState(false);
  const [rForm, setRForm] = useState({
    id: "",
    returnedOn: new Date().toISOString().slice(0, 10),
    fineCollected: 0,
    lost: false,
  });

  async function refreshBooks() {
    const b = await listB({ data: q ? { q } : {} });
    setBooks(b as Book[]);
  }
  async function refreshIssues() {
    const i = await listI({ data: { status: statusFilter } });
    setIssues(i as Issue[]);
  }

  useEffect(() => {
    refreshBooks();
    refreshIssues();
    listStu({ data: { page: 1, pageSize: 100 } })
      .then((s) => setStudents((s as { rows: typeof students }).rows))
      .catch(() => setStudents([]));
    listEmp().then((e) =>
      setEmployees(e as typeof employees),
    );
  }, []);

  useEffect(() => {
    refreshIssues();
  }, [statusFilter]);

  const stats = useMemo(
    () => ({
      titles: books.length,
      copies: books.reduce((s, b) => s + b.totalCopies, 0),
      available: books.reduce((s, b) => s + b.availableCopies, 0),
      issued: issues.filter((i) => i.status === "issued").length,
    }),
    [books, issues],
  );

  async function submitBook() {
    if (!bEdit?.title) return toast.error("Title required");
    try {
      await saveB({
        data: {
          id: bEdit.id,
          title: bEdit.title!,
          author: bEdit.author ?? null,
          isbn: bEdit.isbn ?? null,
          category: bEdit.category ?? null,
          publisher: bEdit.publisher ?? null,
          edition: bEdit.edition ?? null,
          totalCopies: bEdit.totalCopies ?? 1,
          availableCopies: bEdit.availableCopies ?? bEdit.totalCopies ?? 1,
          rackNo: bEdit.rackNo ?? null,
          dailyFine: bEdit.dailyFine ?? 0,
          isActive: bEdit.isActive ?? true,
        },
      });
      toast.success("Saved");
      setBOpen(false);
      setBEdit(null);
      refreshBooks();
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function submitIssue() {
    if (!iForm.bookId) return toast.error("Book required");
    if (iForm.borrowerType === "student" && !iForm.studentId)
      return toast.error("Student required");
    if (iForm.borrowerType === "employee" && !iForm.employeeId)
      return toast.error("Employee required");
    try {
      await issue({
        data: {
          bookId: iForm.bookId,
          borrowerType: iForm.borrowerType,
          studentId:
            iForm.borrowerType === "student" ? iForm.studentId : null,
          employeeId:
            iForm.borrowerType === "employee" ? iForm.employeeId : null,
          issuedOn: iForm.issuedOn,
          dueDate: iForm.dueDate,
          note: iForm.note || null,
        },
      });
      toast.success("Issued");
      setIOpen(false);
      refreshBooks();
      refreshIssues();
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function submitReturn() {
    try {
      const res = await ret({ data: rForm });
      toast.success(`Returned${res?.fine ? ` · fine ₹${res.fine}` : ""}`);
      setROpen(false);
      refreshBooks();
      refreshIssues();
    } catch (e) {
      toast.error(String(e));
    }
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Library"
        description="Catalogue books, issue and return, and collect fines"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Titles" value={stats.titles} />
        <StatCard label="Total copies" value={stats.copies} />
        <StatCard label="Available" value={stats.available} />
        <StatCard label="Currently issued" value={stats.issued} />
      </div>

      <Tabs defaultValue="books">
        <TabsList>
          <TabsTrigger value="books">Books</TabsTrigger>
          <TabsTrigger value="issues">Issues & Returns</TabsTrigger>
        </TabsList>

        <TabsContent value="books" className="space-y-4">
          <div className="flex justify-between gap-2">
            <div className="flex gap-2 flex-1 max-w-md">
              <Input
                placeholder="Search title, author, ISBN"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && refreshBooks()}
              />
              <Button variant="outline" onClick={refreshBooks}>
                Search
              </Button>
            </div>
            <Button
              onClick={() => {
                setBEdit({
                  totalCopies: 1,
                  availableCopies: 1,
                  dailyFine: 0,
                  isActive: true,
                });
                setBOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add book
            </Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Copies</TableHead>
                  <TableHead>Fine/day</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {books.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="font-medium">{b.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.isbn || ""}
                      </div>
                    </TableCell>
                    <TableCell>{b.author || "—"}</TableCell>
                    <TableCell>{b.category || "—"}</TableCell>
                    <TableCell>
                      {b.availableCopies}/{b.totalCopies}
                    </TableCell>
                    <TableCell>₹{b.dailyFine}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setBEdit(b);
                          setBOpen(true);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!confirm("Delete book?")) return;
                          await delB({ data: { id: b.id } });
                          refreshBooks();
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!books.length && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      No books yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          <div className="flex justify-between gap-2">
            <div className="w-48">
              <Select
                value={statusFilter}
                onValueChange={(v) =>
                  setStatusFilter(v as typeof statusFilter)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="issued">Issued</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => {
                setIForm({
                  bookId: "",
                  borrowerType: "student",
                  studentId: "",
                  employeeId: "",
                  issuedOn: new Date().toISOString().slice(0, 10),
                  dueDate: new Date(Date.now() + 14 * 86400000)
                    .toISOString()
                    .slice(0, 10),
                  note: "",
                });
                setIOpen(true);
              }}
              disabled={!books.some((b) => b.availableCopies > 0)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Issue book
            </Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Book</TableHead>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Returned</TableHead>
                  <TableHead>Fine</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.bookTitle}</TableCell>
                    <TableCell>
                      <div>{i.borrowerName}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {i.borrowerType}
                      </div>
                    </TableCell>
                    <TableCell>{i.issuedOn}</TableCell>
                    <TableCell>{i.dueDate}</TableCell>
                    <TableCell>{i.returnedOn || "—"}</TableCell>
                    <TableCell>
                      ₹{i.fineCollected}
                      {i.fineAmount > i.fineCollected && (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          / ₹{i.fineAmount}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{i.status}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {(i.status === "issued" || i.status === "overdue") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Return"
                          onClick={() => {
                            setRForm({
                              id: i.id,
                              returnedOn: new Date().toISOString().slice(0, 10),
                              fineCollected: 0,
                              lost: false,
                            });
                            setROpen(true);
                          }}
                        >
                          <ArrowLeftRight className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!confirm("Delete record?")) return;
                          await delI({ data: { id: i.id } });
                          refreshIssues();
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!issues.length && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground py-8"
                    >
                      No records
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Book dialog */}
      <Dialog open={bOpen} onOpenChange={setBOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{bEdit?.id ? "Edit" : "New"} book</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Title</Label>
              <Input
                value={bEdit?.title ?? ""}
                onChange={(e) => setBEdit({ ...bEdit, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Author</Label>
              <Input
                value={bEdit?.author ?? ""}
                onChange={(e) => setBEdit({ ...bEdit, author: e.target.value })}
              />
            </div>
            <div>
              <Label>ISBN</Label>
              <Input
                value={bEdit?.isbn ?? ""}
                onChange={(e) => setBEdit({ ...bEdit, isbn: e.target.value })}
              />
            </div>
            <div>
              <Label>Category</Label>
              <Input
                value={bEdit?.category ?? ""}
                onChange={(e) =>
                  setBEdit({ ...bEdit, category: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Publisher</Label>
              <Input
                value={bEdit?.publisher ?? ""}
                onChange={(e) =>
                  setBEdit({ ...bEdit, publisher: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Edition</Label>
              <Input
                value={bEdit?.edition ?? ""}
                onChange={(e) =>
                  setBEdit({ ...bEdit, edition: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Rack #</Label>
              <Input
                value={bEdit?.rackNo ?? ""}
                onChange={(e) => setBEdit({ ...bEdit, rackNo: e.target.value })}
              />
            </div>
            <div>
              <Label>Total copies</Label>
              <Input
                type="number"
                value={bEdit?.totalCopies ?? 1}
                onChange={(e) =>
                  setBEdit({
                    ...bEdit,
                    totalCopies: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label>Available</Label>
              <Input
                type="number"
                value={bEdit?.availableCopies ?? 1}
                onChange={(e) =>
                  setBEdit({
                    ...bEdit,
                    availableCopies: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label>Daily fine (₹)</Label>
              <Input
                type="number"
                value={bEdit?.dailyFine ?? 0}
                onChange={(e) =>
                  setBEdit({ ...bEdit, dailyFine: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitBook}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue dialog */}
      <Dialog open={iOpen} onOpenChange={setIOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue book</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Book</Label>
              <Select
                value={iForm.bookId}
                onValueChange={(v) => setIForm({ ...iForm, bookId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose book" />
                </SelectTrigger>
                <SelectContent>
                  {books
                    .filter((b) => b.availableCopies > 0 && b.isActive)
                    .map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.title} ({b.availableCopies} available)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Borrower type</Label>
              <Select
                value={iForm.borrowerType}
                onValueChange={(v) =>
                  setIForm({
                    ...iForm,
                    borrowerType: v as "student" | "employee",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {iForm.borrowerType === "student" ? (
              <div>
                <Label>Student</Label>
                <Select
                  value={iForm.studentId}
                  onValueChange={(v) => setIForm({ ...iForm, studentId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.admissionNo} — {s.firstName} {s.lastName ?? ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Employee</Label>
                <Select
                  value={iForm.employeeId}
                  onValueChange={(v) => setIForm({ ...iForm, employeeId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.employeeCode} — {e.firstName} {e.lastName ?? ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Issued on</Label>
                <Input
                  type="date"
                  value={iForm.issuedOn}
                  onChange={(e) =>
                    setIForm({ ...iForm, issuedOn: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={iForm.dueDate}
                  onChange={(e) =>
                    setIForm({ ...iForm, dueDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Note</Label>
              <Textarea
                value={iForm.note}
                onChange={(e) => setIForm({ ...iForm, note: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitIssue}>Issue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return dialog */}
      <Dialog open={rOpen} onOpenChange={setROpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return book</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Returned on</Label>
              <Input
                type="date"
                value={rForm.returnedOn}
                onChange={(e) =>
                  setRForm({ ...rForm, returnedOn: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Fine collected (₹)</Label>
              <Input
                type="number"
                value={rForm.fineCollected}
                onChange={(e) =>
                  setRForm({
                    ...rForm,
                    fineCollected: Number(e.target.value),
                  })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rForm.lost}
                onChange={(e) =>
                  setRForm({ ...rForm, lost: e.target.checked })
                }
              />
              Mark as lost
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setROpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitReturn}>Confirm return</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border rounded-lg p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
