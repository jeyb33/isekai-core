/*
 * Copyright (C) 2025 Isekai
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth";

export function Settings() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      {/* Connected Account */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Account</CardTitle>
          <CardDescription>Your connected DeviantArt account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="h-16 w-16 rounded-full"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <span className="text-2xl font-medium">
                  {user?.username?.[0]?.toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="text-lg font-medium">{user?.username}</p>
              <p className="text-sm text-muted-foreground">
                DeviantArt ID: {user?.deviantartId}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
