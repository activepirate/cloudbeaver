/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2021 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

export interface ITreeNodeState {
  group?: boolean;
  disabled?: boolean;
  loading?: boolean;
  selected?: boolean;
  externalExpanded?: boolean;
  expanded?: boolean;
  leaf?: boolean;
  filterValue?: string;
}
