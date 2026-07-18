import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { me, changePassword } from "@/lib/auth.functions";
import { updateMyProfile } from "@/lib/users.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession, setSession } from "@/lib/session";

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
  head: () => ({
    meta: [{ title: "My Profile — NextGen Fusion School" }],
  }),
});

function ProfilePage() {
  const meFn = useServerFn(me);
  const saveProfile = useServerFn(updateMyProfile);
  const changePw = useServerFn(changePassword);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const u = (await meFn()) as {
          email: string;
          firstName: string | null;
          lastName: string | null;
        };
        setEmail(u.email);
        setFirstName(u.firstName ?? "");
        setLastName(u.lastName ?? "");
      } catch {
        /* ignore */
      }
    })();
  }, [meFn]);

  async function submitProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      await saveProfile({
        data: {
          firstName,
          lastName: lastName || null,
          phone: phone || null,
        },
      });
      // update local session so sidebar reflects new name immediately
      const s = getSession();
      if (s) {
        setSession({
          ...s,
          user: { ...s.user, firstName, lastName: lastName || null },
        });
      }
      toast.success("Profile updated");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    try {
      await changePw({ data: { currentPassword, newPassword } });
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="p-8">
      <PageHeader
        title="My Profile"
        description="Update your personal details and change your password."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitProfile} className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input value={email} disabled />
                <p className="mt-1 text-xs text-muted-foreground">
                  Email cannot be changed here. Contact your administrator.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>First name</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <Label>Last name</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <Button type="submit">Save profile</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitPassword} className="space-y-4">
              <div>
                <Label>Current password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>New password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Confirm new password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit">Update password</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
