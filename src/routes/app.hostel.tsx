import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listHostels,
  saveHostel,
  deleteHostel,
  listRooms,
  saveRoom,
  deleteRoom,
  listAllocations,
  allocateRoom,
  vacateAllocation,
  deleteAllocation,
} from "@/lib/hostel.functions";
import { listStudents } from "@/lib/students.functions";
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
import { Plus, Trash2, Pencil, LogOut } from "lucide-react";
import { confirmDelete } from "@/lib/confirm";

export const Route = createFileRoute("/app/hostel")({ component: HostelPage });

type Hostel = {
  id: string;
  name: string;
  type: "boys" | "girls" | "mixed";
  address: string | null;
  wardenName: string | null;
  wardenPhone: string | null;
  capacity: number;
  isActive: boolean;
};

type Room = {
  id: string;
  hostelId: string;
  roomNo: string;
  floor: string | null;
  capacity: number;
  monthlyRent: number;
  isActive: boolean;
  occupied: number;
};

type Allocation = {
  id: string;
  roomId: string;
  studentId: string;
  allocatedOn: string;
  vacatedOn: string | null;
  status: "active" | "vacated";
  note: string | null;
  roomNo: string;
  hostelName: string;
  studentName: string;
  admissionNo: string;
};

type StudentLite = {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string | null;
};

function HostelPage() {
  const listH = useServerFn(listHostels);
  const saveH = useServerFn(saveHostel);
  const delH = useServerFn(deleteHostel);
  const listR = useServerFn(listRooms);
  const saveR = useServerFn(saveRoom);
  const delR = useServerFn(deleteRoom);
  const listA = useServerFn(listAllocations);
  const allocR = useServerFn(allocateRoom);
  const vacate = useServerFn(vacateAllocation);
  const delA = useServerFn(deleteAllocation);
  const listStu = useServerFn(listStudents);

  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [selectedHostel, setSelectedHostel] = useState<string>("");

  const [hOpen, setHOpen] = useState(false);
  const [hEdit, setHEdit] = useState<Partial<Hostel> | null>(null);
  const [rOpen, setROpen] = useState(false);
  const [rEdit, setREdit] = useState<Partial<Room> | null>(null);
  const [aOpen, setAOpen] = useState(false);
  const [aForm, setAForm] = useState<{
    roomId: string;
    studentId: string;
    allocatedOn: string;
    note: string;
  }>({
    roomId: "",
    studentId: "",
    allocatedOn: new Date().toISOString().slice(0, 10),
    note: "",
  });

  async function refresh() {
    const [h, a, s] = await Promise.all([
      listH(),
      listA({ data: { status: "active" } }),
      listStu({ data: { page: 1, pageSize: 500 } }),
    ]);
    setHostels(h as Hostel[]);
    setAllocations(a as Allocation[]);
    setStudents((s as { rows: StudentLite[] }).rows);
  }

  async function refreshRooms(hostelId?: string) {
    const r = await listR({ data: hostelId ? { hostelId } : {} });
    setRooms(r as Room[]);
  }

  useEffect(() => {
    refresh();
    refreshRooms();
  }, []);

  useEffect(() => {
    refreshRooms(selectedHostel || undefined);
  }, [selectedHostel]);

  const totalCapacity = useMemo(
    () => hostels.reduce((s, h) => s + (h.capacity || 0), 0),
    [hostels],
  );
  const totalOccupied = allocations.length;

  async function submitHostel() {
    if (!hEdit?.name) return toast.error("Name required");
    try {
      await saveH({
        data: {
          id: hEdit.id,
          name: hEdit.name!,
          type: (hEdit.type as "boys" | "girls" | "mixed") ?? "boys",
          address: hEdit.address ?? null,
          wardenName: hEdit.wardenName ?? null,
          wardenPhone: hEdit.wardenPhone ?? null,
          capacity: hEdit.capacity ?? 0,
          isActive: hEdit.isActive ?? true,
        },
      });
      toast.success("Saved");
      setHOpen(false);
      setHEdit(null);
      refresh();
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function submitRoom() {
    if (!rEdit?.hostelId || !rEdit?.roomNo)
      return toast.error("Hostel and room number required");
    try {
      await saveR({
        data: {
          id: rEdit.id,
          hostelId: rEdit.hostelId!,
          roomNo: rEdit.roomNo!,
          floor: rEdit.floor ?? null,
          capacity: rEdit.capacity ?? 1,
          monthlyRent: rEdit.monthlyRent ?? 0,
          isActive: rEdit.isActive ?? true,
        },
      });
      toast.success("Saved");
      setROpen(false);
      setREdit(null);
      refreshRooms(selectedHostel || undefined);
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function submitAllocation() {
    if (!aForm.roomId || !aForm.studentId)
      return toast.error("Room and student required");
    try {
      await allocR({ data: { ...aForm, note: aForm.note || null } });
      toast.success("Allocated");
      setAOpen(false);
      refresh();
      refreshRooms(selectedHostel || undefined);
    } catch (e) {
      toast.error(String(e));
    }
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Hostel"
        description="Manage hostel buildings, rooms, and student allocations"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Hostels" value={hostels.length} />
        <StatCard label="Rooms" value={rooms.length} />
        <StatCard label="Total capacity" value={totalCapacity} />
        <StatCard
          label="Occupied"
          value={`${totalOccupied}/${totalCapacity}`}
        />
      </div>

      <Tabs defaultValue="hostels">
        <TabsList>
          <TabsTrigger value="hostels">Hostels</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="allocations">Allocations</TabsTrigger>
        </TabsList>

        <TabsContent value="hostels" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setHEdit({ type: "boys", isActive: true, capacity: 0 });
                setHOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add hostel
            </Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Warden</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hostels.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.name}</TableCell>
                    <TableCell className="capitalize">{h.type}</TableCell>
                    <TableCell>
                      {h.wardenName || "—"}
                      {h.wardenPhone && (
                        <span className="text-muted-foreground text-xs block">
                          {h.wardenPhone}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{h.capacity}</TableCell>
                    <TableCell>{h.isActive ? "Active" : "Inactive"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setHEdit(h);
                          setHOpen(true);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!confirm("Delete hostel?")) return;
                          await delH({ data: { id: h.id } });
                          refresh();
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!hostels.length && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      No hostels yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="rooms" className="space-y-4">
          <div className="flex justify-between gap-2">
            <div className="w-64">
              <Select
                value={selectedHostel}
                onValueChange={(v) => setSelectedHostel(v === "all" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by hostel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All hostels</SelectItem>
                  {hostels.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => {
                setREdit({
                  hostelId: selectedHostel || hostels[0]?.id,
                  capacity: 1,
                  monthlyRent: 0,
                  isActive: true,
                });
                setROpen(true);
              }}
              disabled={!hostels.length}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add room
            </Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hostel</TableHead>
                  <TableHead>Room #</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead>Occupancy</TableHead>
                  <TableHead>Rent</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((r) => {
                  const h = hostels.find((x) => x.id === r.hostelId);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>{h?.name || "—"}</TableCell>
                      <TableCell className="font-medium">{r.roomNo}</TableCell>
                      <TableCell>{r.floor || "—"}</TableCell>
                      <TableCell>
                        {r.occupied}/{r.capacity}
                      </TableCell>
                      <TableCell>₹{r.monthlyRent}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setREdit(r);
                            setROpen(true);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            if (!confirm("Delete room?")) return;
                            await delR({ data: { id: r.id } });
                            refreshRooms(selectedHostel || undefined);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!rooms.length && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      No rooms yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="allocations" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setAForm({
                  roomId: "",
                  studentId: "",
                  allocatedOn: new Date().toISOString().slice(0, 10),
                  note: "",
                });
                setAOpen(true);
              }}
              disabled={!rooms.length || !students.length}
            >
              <Plus className="w-4 h-4 mr-2" />
              Allocate room
            </Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Hostel</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Allocated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocations.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">{a.studentName}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.admissionNo}
                      </div>
                    </TableCell>
                    <TableCell>{a.hostelName}</TableCell>
                    <TableCell>{a.roomNo}</TableCell>
                    <TableCell>{a.allocatedOn}</TableCell>
                    <TableCell className="capitalize">{a.status}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {a.status === "active" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Vacate"
                          onClick={async () => {
                            const on =
                              prompt(
                                "Vacate date (YYYY-MM-DD):",
                                new Date().toISOString().slice(0, 10),
                              ) || "";
                            if (!on) return;
                            await vacate({
                              data: { id: a.id, vacatedOn: on },
                            });
                            toast.success("Vacated");
                            refresh();
                            refreshRooms(selectedHostel || undefined);
                          }}
                        >
                          <LogOut className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!confirmDelete("hostel record")) return;
                          await delA({ data: { id: a.id } });
                          refresh();
                          refreshRooms(selectedHostel || undefined);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!allocations.length && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      No active allocations
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Hostel dialog */}
      <Dialog open={hOpen} onOpenChange={setHOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{hEdit?.id ? "Edit" : "New"} hostel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={hEdit?.name ?? ""}
                onChange={(e) =>
                  setHEdit({ ...hEdit, name: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select
                  value={hEdit?.type ?? "boys"}
                  onValueChange={(v) =>
                    setHEdit({ ...hEdit, type: v as Hostel["type"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boys">Boys</SelectItem>
                    <SelectItem value="girls">Girls</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Capacity</Label>
                <Input
                  type="number"
                  value={hEdit?.capacity ?? 0}
                  onChange={(e) =>
                    setHEdit({ ...hEdit, capacity: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Warden name</Label>
                <Input
                  value={hEdit?.wardenName ?? ""}
                  onChange={(e) =>
                    setHEdit({ ...hEdit, wardenName: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Warden phone</Label>
                <Input
                  value={hEdit?.wardenPhone ?? ""}
                  onChange={(e) =>
                    setHEdit({ ...hEdit, wardenPhone: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Textarea
                value={hEdit?.address ?? ""}
                onChange={(e) =>
                  setHEdit({ ...hEdit, address: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitHostel}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Room dialog */}
      <Dialog open={rOpen} onOpenChange={setROpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{rEdit?.id ? "Edit" : "New"} room</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Hostel</Label>
              <Select
                value={rEdit?.hostelId ?? ""}
                onValueChange={(v) => setREdit({ ...rEdit, hostelId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose hostel" />
                </SelectTrigger>
                <SelectContent>
                  {hostels.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Room #</Label>
                <Input
                  value={rEdit?.roomNo ?? ""}
                  onChange={(e) =>
                    setREdit({ ...rEdit, roomNo: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Floor</Label>
                <Input
                  value={rEdit?.floor ?? ""}
                  onChange={(e) =>
                    setREdit({ ...rEdit, floor: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Capacity</Label>
                <Input
                  type="number"
                  value={rEdit?.capacity ?? 1}
                  onChange={(e) =>
                    setREdit({ ...rEdit, capacity: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Monthly rent (₹)</Label>
                <Input
                  type="number"
                  value={rEdit?.monthlyRent ?? 0}
                  onChange={(e) =>
                    setREdit({
                      ...rEdit,
                      monthlyRent: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setROpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitRoom}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Allocation dialog */}
      <Dialog open={aOpen} onOpenChange={setAOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allocate room</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Room</Label>
              <Select
                value={aForm.roomId}
                onValueChange={(v) => setAForm({ ...aForm, roomId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms
                    .filter((r) => r.occupied < r.capacity && r.isActive)
                    .map((r) => {
                      const h = hostels.find((x) => x.id === r.hostelId);
                      return (
                        <SelectItem key={r.id} value={r.id}>
                          {h?.name} · Room {r.roomNo} ({r.occupied}/{r.capacity})
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Student</Label>
              <Select
                value={aForm.studentId}
                onValueChange={(v) => setAForm({ ...aForm, studentId: v })}
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
            <div>
              <Label>Allocated on</Label>
              <Input
                type="date"
                value={aForm.allocatedOn}
                onChange={(e) =>
                  setAForm({ ...aForm, allocatedOn: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Note</Label>
              <Textarea
                value={aForm.note}
                onChange={(e) => setAForm({ ...aForm, note: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitAllocation}>Allocate</Button>
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
