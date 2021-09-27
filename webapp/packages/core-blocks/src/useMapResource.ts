/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2021 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { observable } from 'mobx';
import { useEffect, useState } from 'react';

import { IServiceConstructor, useService } from '@cloudbeaver/core-di';
import { NotificationService } from '@cloudbeaver/core-events';
import { CachedResourceIncludeArgs, CachedMapResource, CachedMapResourceGetter, ResourceKey, CachedMapResourceValue, CachedMapResourceKey, CachedMapResourceArguments, CachedMapResourceLoader, ResourceKeyList, CachedMapResourceListGetter } from '@cloudbeaver/core-sdk';

import { getComputed } from './getComputed';
import type { ILoadableState } from './Loader/Loader';
import { useObservableRef } from './useObservableRef';

interface IActions<
  TKeyArg extends ResourceKey<CachedMapResourceKey<TResource>>,
  TResource extends CachedMapResource<any, any, any>,
  TIncludes
> {
  isActive?: (resource: TResource) => Promise<boolean> | boolean;
  onLoad?: (resource: TResource) => Promise<boolean | void> | boolean | void;
  onData?: (
    data: CachedMapResourceLoader<
    TKeyArg,
    CachedMapResourceKey<TResource>,
    CachedMapResourceValue<TResource>,
    TIncludes
    >,
    resource: TResource,
    prevData: CachedMapResourceLoader<
    TKeyArg,
    CachedMapResourceKey<TResource>,
    CachedMapResourceValue<TResource>,
    TIncludes
    > | undefined,
  ) => Promise<any> | any;
  onError?: (exception: Error) => void;
}

interface KeyWithIncludes<TKey, TIncludes> {
  key: TKey | null;
  includes: TIncludes;
}

interface IMapResourceListResult<
  TResource extends CachedMapResource<any, any, any>,
  TIncludes
> extends ILoadableState {
  data: CachedMapResourceListGetter<
  CachedMapResourceValue<TResource>,
  TIncludes
  >;
  resource: TResource;
  exception: Error[] | null;
  reload: () => void;
}

interface IMapResourceResult<
  TResource extends CachedMapResource<any, any, any>,
  TIncludes
> extends ILoadableState {
  data: CachedMapResourceGetter<
  CachedMapResourceValue<TResource>,
  TIncludes
  >;
  resource: TResource;
  exception: Error | null;
  reload: () => void;
}

export function useMapResource<
  TResource extends CachedMapResource<any, any, any>,
  TIncludes extends CachedResourceIncludeArgs<
  CachedMapResourceValue<TResource>,
  CachedMapResourceArguments<TResource>
  > = []
>(
  ctor: IServiceConstructor<TResource> | TResource,
  keyObj: TResource extends any
    ? CachedMapResourceKey<TResource> | null | KeyWithIncludes<CachedMapResourceKey<TResource>, TIncludes>
    : never,
  actions?: TResource extends any ? IActions<CachedMapResourceKey<TResource>, TResource, TIncludes> : never
): IMapResourceResult<TResource, TIncludes>;

export function useMapResource<
  TResource extends CachedMapResource<any, any, any>,
  TIncludes extends CachedResourceIncludeArgs<
  CachedMapResourceValue<TResource>,
  CachedMapResourceArguments<TResource>
  > = []
>(
  ctor: IServiceConstructor<TResource> | TResource,
  keyObj: TResource extends any
    ? (
      ResourceKeyList<CachedMapResourceKey<TResource>>
      | null
      | KeyWithIncludes<ResourceKeyList<CachedMapResourceKey<TResource>>, TIncludes>
    )
    : never,
  actions?: TResource extends any
    ? IActions<ResourceKeyList<CachedMapResourceKey<TResource>>, TResource, TIncludes>
    : never
): IMapResourceListResult<TResource, TIncludes>;

export function useMapResource<
  TResource extends CachedMapResource<any, any, any>,
  TKeyArg extends ResourceKey<CachedMapResourceKey<TResource>>,
  TIncludes extends CachedResourceIncludeArgs<
  CachedMapResourceValue<TResource>,
  CachedMapResourceArguments<TResource>
  > = []
>(
  ctor: IServiceConstructor<TResource> | TResource,
  keyObj: TResource extends any ? TKeyArg | null | KeyWithIncludes<TKeyArg, TIncludes> : never,
  actions?: TResource extends any ? IActions<TKeyArg, TResource, TIncludes> : never
): IMapResourceResult<TResource, TIncludes> | IMapResourceListResult<TResource, TIncludes> {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const resource = ctor instanceof CachedMapResource ? ctor : useService(ctor);
  const notifications = useService(NotificationService);
  const [exception, setException] = useState<Error | null>(null);
  let key: TKeyArg | null = keyObj as TKeyArg;
  let includes: TIncludes = [] as TIncludes;

  if (isKeyWithIncludes<TKeyArg, TIncludes>(keyObj)) {
    key = keyObj.key;
    includes = keyObj.includes;
  }

  const refObj = useObservableRef(() => ({
    loading: false,
    firstRender: true,
    prevData: undefined as CachedMapResourceLoader<
    TKeyArg,
    CachedMapResourceKey<TResource>,
    CachedMapResourceValue<TResource>,
    TIncludes
    > | undefined,
    async load() {
      this.firstRender = false;
      const { resource, actions, prevData, key, includes } = this;

      const active = await actions?.isActive?.(resource);

      if (this.loading || active === false) {
        return;
      }

      this.loading = true;

      try {
        const prevent = await actions?.onLoad?.(resource);

        if (key === null || prevent === true) {
          setException(null);
          return;
        }

        const newData = await resource.load(key, includes as any);
        setException(null);

        try {
          await actions?.onData?.(
            newData,
            resource,
            prevData
          );
        } finally {
          this.prevData = newData;
        }
      } catch (exception) {
        if (resource.getException(key) === null) {
          setException(exception);
        }
        actions?.onError?.(exception);
        if (!this.exceptionObserved) {
          notifications.logException(exception, 'Can\'t load data');
        }
      } finally {
        this.loading = false;
      }
    },
  }), {
    loading: observable.ref,
  }, {
    exceptionObserved: false,
    resource,
    key,
    exception,
    includes,
    actions,
  });

  const outdated = getComputed(() => (
    (resource.isOutdated(key) || !resource.isLoaded(key, includes as any))
    && !resource.isDataLoading(key)
  ));

  const [result] = useState<
  IMapResourceResult<TResource, TIncludes>
  | IMapResourceListResult<TResource, TIncludes>
  >(() => ({
    get resource() {
      return refObj.resource;
    },
    get exception() {
      refObj.exceptionObserved = true;
      return refObj.exception || resource.getException(key);
    },
    get data() {
      if (refObj.key === null) {
        return undefined;
      }

      return resource.get(refObj.key);
    },
    isLoaded: () => {
      if (refObj.key === null) {
        return true;
      }

      return resource.isLoaded(refObj.key, refObj.includes as any);
    },
    reload: () => {
      setException(null);
      refObj.load();
    },
    isLoading: () => {
      if (refObj.key === null) {
        return false;
      }

      return refObj.loading || resource.isDataLoading(refObj.key);
    },
  }));

  useEffect(() => {
    if (!outdated && !refObj.firstRender) {
      return;
    }

    if (result.exception === null || (Array.isArray(result.exception) && !result.exception.some(Boolean))) {
      refObj.load();
    }
  });

  return result;
}

function isKeyWithIncludes<TKey, TIncludes>(obj: any): obj is KeyWithIncludes<TKey, TIncludes> {
  return obj && typeof obj === 'object' && 'includes' in obj && 'key' in obj;
}
