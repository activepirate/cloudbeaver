/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2021 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { action, computed, makeObservable, runInAction } from 'mobx';

import { Executor, IExecutor } from '@cloudbeaver/core-executor';
import { MetadataMap } from '@cloudbeaver/core-utils';

import { CachedResource, ICachedResourceMetadata } from './CachedResource';
import type { CachedResourceIncludeArgs, CachedResourceValueIncludes } from './CachedResourceIncludes';
import { ResourceKey, resourceKeyList, ResourceKeyList, ResourceKeyUtils } from './ResourceKeyList';

export type CachedMapResourceKey<
  TResource extends CachedMapResource<any, any, any>
> = TResource extends CachedResource<Map<infer T, any>, any, any, any> ? T : never;

export type CachedMapResourceValue<TResource> = TResource extends CachedResource<Map<any, infer T>, any, any, any>
  ? T
  : never;

export type CachedMapResourceArguments<
  TResource extends CachedMapResource<any, any, any>
> = TResource extends CachedMapResource<any, any, infer T> ? T : never;

export type CachedMapResourceListGetter<
  TValue,
  TIncludes
> = Array<CachedResourceValueIncludes<TValue, TIncludes> | undefined>;

export type CachedMapResourceGetter<
  TValue,
  TIncludes
> = CachedResourceValueIncludes<TValue, TIncludes> | undefined;

export type CachedMapResourceLoader<
  TRealKey extends ResourceKey<TKey>,
  TKey,
  TValue,
  TIncludes
> = TRealKey extends ResourceKeyList<TKey>
  ? Array<CachedResourceValueIncludes<TValue, TIncludes>>
  : CachedResourceValueIncludes<TValue, TIncludes>;

export interface ICachedMapResourceMetadata extends ICachedResourceMetadata {
  includes: string[];
}

export const CachedMapAllKey = resourceKeyList<any>([Symbol('@cached-map-resource/all')], 'all');

export abstract class CachedMapResource<
  TKey,
  TValue,
  TArguments = Record<string, any>
> extends CachedResource<
  Map<TKey, TValue>,
  ResourceKey<TKey>,
  TKey,
  string[] | undefined
  > {
  readonly onItemAdd: IExecutor<ResourceKey<TKey>>;
  readonly onItemDelete: IExecutor<ResourceKey<TKey>>;
  protected metadata: MetadataMap<TKey, ICachedMapResourceMetadata>;
  protected defaultIncludes: string[];

  get values(): TValue[] {
    return Array.from(this.data.values());
  }

  get keys(): TKey[] {
    return Array.from(this.data.keys());
  }

  constructor(defaultIncludes?: CachedResourceIncludeArgs<TValue, TArguments>, defaultValue?: Map<TKey, TValue>) {
    super(defaultValue || new Map());
    this.onItemAdd = new Executor(null, this.includes);
    this.onItemDelete = new Executor(null, this.includes);
    this.defaultIncludes = defaultIncludes || [];

    this.metadata = new MetadataMap(() => ({
      outdated: true,
      loading: false,
      exception: null,
      includes: [...this.defaultIncludes],
    }));

    this.addAlias(CachedMapAllKey, key => {
      if (this.keys.length > 0) {
        return resourceKeyList(this.keys, CachedMapAllKey.mark);
      }
      return resourceKeyList([]);
    });

    makeObservable(this, {
      set: action,
      delete: action,
      clear: action,
      values: computed,
      keys: computed,
    });
  }

  isIncludes(key: ResourceKey<TKey>, includes: CachedResourceIncludeArgs<TValue, TArguments>): boolean {
    key = this.transformParam(key);
    return ResourceKeyUtils.every(key, key => {
      const metadata = this.metadata.get(key);

      return includes.every(include => metadata.includes.includes(include));
    });
  }

  getException(key: TKey): Error | null;
  getException(key: ResourceKeyList<TKey>): Array<Error | null>;
  getException(key: ResourceKey<TKey>): Array<Error | null>| Error | null;
  getException(key: ResourceKey<TKey>): Array<Error | null>| Error | null {
    if (ResourceKeyUtils.some(key, key => !this.has(key))) { // TODO: metadata isn't properly cleared while rename with opened in Metadata Editor node
      return null;
    }
    key = this.transformParam(key);
    return ResourceKeyUtils.map(key, key => this.metadata.get(key).exception);
  }

  isOutdated(key: ResourceKey<TKey>): boolean {
    if (this.isAlias(key) && !this.isAliasLoaded(key)) {
      return true;
    }

    key = this.transformParam(key);
    return ResourceKeyUtils.some(key, key => this.metadata.get(key).outdated);
  }

  isDataLoading(key: ResourceKey<TKey>): boolean {
    key = this.transformParam(key);
    return ResourceKeyUtils.some(key, key => this.metadata.get(key).loading);
  }

  markDataLoading(key: ResourceKey<TKey>, includes?: string[]): void {
    key = this.transformParam(key);
    ResourceKeyUtils.forEach(key, key => {
      const metadata = this.metadata.get(key);
      metadata.loading = true;
    });
  }

  markDataLoaded(key: ResourceKey<TKey>, includes?: string[]): void {
    key = this.transformParam(key);

    if (includes) {
      this.commitIncludes(key, includes);
    }

    ResourceKeyUtils.forEach(key, key => {
      const metadata = this.metadata.get(key);
      metadata.loading = false;
    });
  }

  async markDataError(exception: Error, key: ResourceKey<TKey>): Promise<void> {
    key = this.transformParam(key);

    ResourceKeyUtils.forEach(key, key => {
      const metadata = this.metadata.get(key);
      metadata.exception = exception;
    });

    await this.onDataError.execute({ param: key, exception });
  }

  markOutdated(): Promise<void>
  markOutdated(key: ResourceKey<TKey>): Promise<void>
  async markOutdated(key?: ResourceKey<TKey>): Promise<void> {
    if (key === undefined) {
      key = ResourceKeyUtils.join(resourceKeyList(this.keys), ...this.loadedKeys.map(key => this.transformParam(key)));
      this.loadedKeys = [];
    } else {
      if (this.isAlias(key)) {
        const index = this.loadedKeys.findIndex(loadedKey => this.includes(key!, loadedKey));

        if (index >= 0) {
          this.loadedKeys.splice(index, 1);
        }
      }

      key = this.transformParam(key);
    }

    runInAction(() => ResourceKeyUtils.forEach(key!, key => {
      const metadata = this.metadata.get(key);
      metadata.outdated = true;
    }));

    await this.onDataOutdated.execute(key);
  }

  markUpdated(): void
  markUpdated(key: ResourceKey<TKey>): void
  markUpdated(key?: ResourceKey<TKey>): void {
    if (key === undefined) {
      // TODO: maybe should add all aliases to loadedKeys
      key = resourceKeyList(this.keys);
    } else {
      if (this.isAlias(key) && !this.isAliasLoaded(key)) {
        this.loadedKeys.push(key);
      }
      key = this.transformParam(key);
    }

    ResourceKeyUtils.forEach(key, key => {
      const metadata = this.metadata.get(key);
      metadata.outdated = false;
      metadata.exception = null;
    });
  }

  isLoaded(key: ResourceKey<TKey>, includes?: CachedResourceIncludeArgs<TValue, TArguments>): boolean {
    if (this.isAlias(key) && !this.isAliasLoaded(key)) {
      return false;
    }

    key = this.transformParam(key);
    return ResourceKeyUtils.every(key, key => {
      if (!this.has(key)) {
        return false;
      }

      if (includes) {
        const metadata = this.metadata.get(key);

        if (includes.some(include => !metadata.includes.includes(include))) {
          return false;
        }
      }
      return true;
    });
  }

  get(key: TKey): TValue | undefined;
  get(key: ResourceKeyList<TKey>): Array<TValue | undefined>;
  get(key: ResourceKey<TKey>): Array<TValue | undefined>| TValue | undefined;
  get(key: ResourceKey<TKey>): Array<TValue | undefined>| TValue | undefined {
    key = this.transformParam(key);
    return ResourceKeyUtils.map(key, key => this.data.get(key));
  }

  set(key: TKey, value: TValue): void;
  set(key: ResourceKeyList<TKey>, value: TValue[]): void;
  set(key: ResourceKey<TKey>, value: TValue | TValue[]): void;
  set(key: ResourceKey<TKey>, value: TValue | TValue[]): void {
    key = this.transformParam(key);
    ResourceKeyUtils.forEach(key, (key, i) => {
      if (i === -1) {
        this.data.set(key, value as TValue);
      } else {
        this.data.set(key, (value as TValue[])[i]);
      }
    });
    this.markUpdated(key);
    this.onItemAdd.execute(key);
  }

  delete(key: TKey): void;
  delete(key: ResourceKeyList<TKey>): void;
  delete(key: ResourceKey<TKey>): void;
  delete(key: ResourceKey<TKey>): void {
    key = this.transformParam(key);

    this.onItemDelete
      .execute(key)
      .finally(() => {
        runInAction(() => {
          ResourceKeyUtils.forEach(key, key => this.data.delete(key));
          this.markUpdated(key);
        });
      });
  }

  clear(): void {
    this.data.clear();
    this.metadata.clear();
  }

  async refresh<T extends CachedResourceIncludeArgs<TValue, TArguments> = []>(
    key: TKey,
    includes?: T
  ): Promise<CachedResourceValueIncludes<TValue, T>>;
  async refresh<T extends CachedResourceIncludeArgs<TValue, TArguments> = []>(
    key: ResourceKeyList<TKey>,
    includes?: T
  ): Promise<Array<CachedResourceValueIncludes<TValue, T>>>;
  async refresh<T extends CachedResourceIncludeArgs<TValue, TArguments> = []>(
    key: ResourceKey<TKey>,
    includes?: T
  ): Promise<Array<CachedResourceValueIncludes<TValue, T>> | CachedResourceValueIncludes<TValue, T>>;
  async refresh<T extends CachedResourceIncludeArgs<TValue, TArguments> = []>(
    key: ResourceKey<TKey>,
    includes?: T
  ): Promise<Array<CachedResourceValueIncludes<TValue, T>> | CachedResourceValueIncludes<TValue, T>> {
    await this.loadData(key, true, includes);
    return this.get(key) as Array<CachedResourceValueIncludes<TValue, T>> | CachedResourceValueIncludes<TValue, T>;
  }

  async load<T extends CachedResourceIncludeArgs<TValue, TArguments> = []>(
    key: TKey,
    includes?: T
  ): Promise<CachedResourceValueIncludes<TValue, T>>;
  async load<T extends CachedResourceIncludeArgs<TValue, TArguments> = []>(
    key: ResourceKeyList<TKey>,
    includes?: T
  ): Promise<Array<CachedResourceValueIncludes<TValue, T>>>;
  async load<T extends CachedResourceIncludeArgs<TValue, TArguments> = []>(
    key: ResourceKey<TKey>,
    includes?: T
  ): Promise<Array<CachedResourceValueIncludes<TValue, T>> | CachedResourceValueIncludes<TValue, T>>;
  async load<T extends CachedResourceIncludeArgs<TValue, TArguments> = []>(
    key: ResourceKey<TKey>,
    includes?: T
  ): Promise<Array<CachedResourceValueIncludes<TValue, T>> | CachedResourceValueIncludes<TValue, T>> {
    await this.loadData(key, false, includes);
    return this.get(key) as Array<CachedResourceValueIncludes<TValue, T>> | CachedResourceValueIncludes<TValue, T>;
  }

  has(key: TKey): boolean {
    if (this.isAlias(key) && !this.isAliasLoaded(key)) {
      return false;
    }

    key = this.transformParam(key) as TKey;
    return this.data.has(key);
  }

  includes(param: ResourceKey<TKey>, key: ResourceKey<TKey>): boolean {
    return ResourceKeyUtils.includes(param, key);
  }

  getIncludes(key?: ResourceKey<TKey>): string[] {
    if (key === undefined) {
      return this.defaultIncludes;
    }
    key = this.transformParam(key);

    const metadata = this.metadata.get(ResourceKeyUtils.first(key));

    return metadata.includes;
  }

  getIncludesMap(key?: ResourceKey<TKey>, includes: string[] = this.defaultIncludes): Record<string, any> {
    const keyIncludes = this.getIncludes(key);
    return ['customIncludeBase', ...includes, ...keyIncludes].reduce<any>((map, key) => {
      map[key] = true;

      return map;
    }, {});
  }

  protected resetIncludes(): void {
    const keys = resourceKeyList(this.keys);
    ResourceKeyUtils.forEach(keys, key => {
      const metadata = this.metadata.get(key);

      metadata.includes = [...this.defaultIncludes];
    });
  }

  protected commitIncludes(key: ResourceKey<TKey>, includes: string[]): void {
    key = this.transformParam(key);
    ResourceKeyUtils.forEach(key, key => {
      const metadata = this.metadata.get(key);

      for (const include of includes) {
        if (!metadata.includes.includes(include)) {
          metadata.includes.push(include);
        }
      }
    });
  }
}
