/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2022 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { action, makeObservable } from 'mobx';

import { ConnectionInfoResource, ConnectionsManagerService } from '@cloudbeaver/core-connections';
import { injectable } from '@cloudbeaver/core-di';
import { NotificationService } from '@cloudbeaver/core-events';
import { ISyncExecutor, SyncExecutor } from '@cloudbeaver/core-executor';
import { ResourceKey, resourceKeyList } from '@cloudbeaver/core-sdk';
import { MetadataMap } from '@cloudbeaver/core-utils';
import type { IActiveView } from '@cloudbeaver/core-view';
import { View } from '@cloudbeaver/core-view';

import { EObjectFeature } from '../shared/NodesManager/EObjectFeature';
import { NavNodeExtensionsService } from '../shared/NodesManager/NavNodeExtensionsService';
import { ROOT_NODE_PATH } from '../shared/NodesManager/NavNodeInfoResource';
import { NavNodeManagerService } from '../shared/NodesManager/NavNodeManagerService';
import { NavTreeResource } from '../shared/NodesManager/NavTreeResource';
import { NodeManagerUtils } from '../shared/NodesManager/NodeManagerUtils';
import type { ITreeNodeState } from './useElementsTree';

export interface INavigationNodeSelectionData {
  id: ResourceKey<string>;
  selected: boolean[];
}

@injectable()
export class NavigationTreeService extends View<string> {
  readonly treeState: MetadataMap<string, ITreeNodeState>;
  readonly nodeSelectionTask: ISyncExecutor<INavigationNodeSelectionData>;

  constructor(
    private navNodeManagerService: NavNodeManagerService,
    private notificationService: NotificationService,
    private connectionsManagerService: ConnectionsManagerService,
    private connectionInfoResource: ConnectionInfoResource,
    private navNodeExtensionsService: NavNodeExtensionsService,
    private navTreeResource: NavTreeResource
  ) {
    super();

    makeObservable<NavigationTreeService, 'unselectAll'>(this, {
      selectNode: action,
      unselectAll: action,
    });

    this.treeState = new MetadataMap(() => ({
      filter: '',
      expanded: false,
      selected: false,
    }));

    this.nodeSelectionTask = new SyncExecutor();
    this.getView = this.getView.bind(this);
  }

  getChildren(id: string): string[] | undefined {
    return this.navTreeResource.get(id);
  }

  async navToNode(id: string, parentId: string): Promise<void> {
    await this.navNodeManagerService.navToNode(id, parentId);
  }

  async loadNestedNodes(id = ROOT_NODE_PATH, tryConnect?: boolean, notify = true): Promise<boolean> {
    try {
      if (this.isConnectionNode(id)) {
        const connection = await this.connectionInfoResource.load(
          NodeManagerUtils.connectionNodeIdToConnectionId(id)
        );

        if (!connection.connected && !tryConnect) {
          return false;
        }

        const connected = await this.tryInitConnection(id);

        if (!connected) {
          return false;
        }
      }

      await this.navTreeResource.waitLoad();

      if (tryConnect && this.navTreeResource.getException(id)) {
        this.navTreeResource.markOutdated(id);
      }

      await this.navTreeResource.load(id);
      return true;
    } catch (exception) {
      if (notify) {
        this.notificationService.logException(exception);
      }
    }
    return false;
  }

  selectNode(id: string, multiple?: boolean): void {
    if (!multiple) {
      this.unselectAll();
    }

    const metadata = this.treeState.get(id);
    metadata.selected = !metadata.selected;

    this.nodeSelectionTask.execute({
      id,
      selected: [metadata.selected],
    });
  }

  isNodeExpanded(navNodeId: string): boolean {
    return this.treeState.get(navNodeId).expanded;
  }

  isNodeSelected(navNodeId: string): boolean {
    return this.treeState.get(navNodeId).selected;
  }

  expandNode(navNodeId: string, state: boolean): void {
    const metadata = this.treeState.get(navNodeId);
    metadata.expanded = state;
  }

  getView(): IActiveView<string> | null {
    const element = Array.from(this.treeState).find(([key, metadata]) => metadata.selected);

    if (!element) {
      return null;
    }

    return {
      context: element[0],
      extensions: this.navNodeExtensionsService.extensions,
    };
  }

  private unselectAll() {
    const list: string[] = [];

    for (const [id, metadata] of this.treeState) {
      metadata.selected = false;
      list.push(id);
    }

    this.nodeSelectionTask.execute({
      id: resourceKeyList(list),
      selected: list.map(() => false),
    });
  }

  private isConnectionNode(navNodeId: string) {
    const node = this.navNodeManagerService.getNode(navNodeId);
    return node?.objectFeatures.includes(EObjectFeature.dataSource);
  }

  private async tryInitConnection(navNodeId: string): Promise<boolean> {
    const connection = await this.connectionsManagerService.requireConnection(
      NodeManagerUtils.connectionNodeIdToConnectionId(navNodeId)
    );

    return connection?.connected || false;
  }
}
