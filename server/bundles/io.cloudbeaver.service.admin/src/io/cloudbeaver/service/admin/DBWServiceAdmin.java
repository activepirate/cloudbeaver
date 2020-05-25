/*
 * DBeaver - Universal Database Manager
 * Copyright (C) 2010-2020 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package io.cloudbeaver.service.admin;

import io.cloudbeaver.DBWService;
import io.cloudbeaver.DBWebException;
import io.cloudbeaver.WebAction;
import io.cloudbeaver.model.session.WebSession;
import org.jkiss.code.NotNull;
import org.jkiss.code.Nullable;

import java.util.List;

/**
 * Web service API
 */
public interface DBWServiceAdmin extends DBWService {

    @WebAction(requirePermissions = AdminPermissions.PERMISSION_ADMIN)
    @NotNull
    List<AdminUserInfo> listUsers(@NotNull WebSession webSession, @Nullable String userName) throws DBWebException;

    @WebAction(requirePermissions = AdminPermissions.PERMISSION_ADMIN)
    @NotNull
    List<AdminRoleInfo> listRoles(@NotNull WebSession webSession, @Nullable String roleName) throws DBWebException;

    @WebAction(requirePermissions = AdminPermissions.PERMISSION_ADMIN)
    @NotNull
    List<AdminPermissionInfo> listPermissions(@NotNull WebSession webSession) throws DBWebException;

    @WebAction(requirePermissions = AdminPermissions.PERMISSION_ADMIN)
    @NotNull
    AdminUserInfo createUser(@NotNull WebSession webSession, String userName) throws DBWebException;

    @WebAction(requirePermissions = AdminPermissions.PERMISSION_ADMIN)
    boolean deleteUser(@NotNull WebSession webSession, String userName) throws DBWebException;

    @WebAction(requirePermissions = AdminPermissions.PERMISSION_ADMIN)
    @NotNull
    AdminRoleInfo createRole(@NotNull WebSession webSession, String roleName) throws DBWebException;

    @WebAction(requirePermissions = AdminPermissions.PERMISSION_ADMIN)
    boolean deleteRole(@NotNull WebSession webSession, String roleName) throws DBWebException;

    @WebAction(requirePermissions = AdminPermissions.PERMISSION_ADMIN)
    boolean grantUserRole(@NotNull WebSession webSession, String user, String role) throws DBWebException;

    @WebAction(requirePermissions = AdminPermissions.PERMISSION_ADMIN)
    boolean revokeUserRole(@NotNull WebSession webSession, String user, String role) throws DBWebException;

    @WebAction(requirePermissions = AdminPermissions.PERMISSION_ADMIN)
    boolean setRolePermissions(@NotNull WebSession webSession, String roleID, String[] permissions) throws DBWebException;

}
