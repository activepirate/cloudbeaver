/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2021 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { observer } from 'mobx-react-lite';
import { useContext } from 'react';

import { EventContext, EventStopPropagationFlag } from '@cloudbeaver/core-events';

import { EventTreeNodeExpandFlag } from './EventTreeNodeExpandFlag';
import { EventTreeNodeSelectFlag } from './EventTreeNodeSelectFlag';
import type { ITreeNodeState } from './ITreeNodeState';
import { TreeNodeContext } from './TreeNodeContext';

const KEY = {
  ENTER: 'Enter',
};

interface Props extends ITreeNodeState {
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  className?: string;
  big?: boolean;
}

export const TreeNodeControl = observer<Props>(function TreeNodeControl({
  group,
  disabled,
  loading,
  selected,
  filterValue,
  expanded,
  externalExpanded,
  leaf,
  onClick,
  className,
  children,
}) {
  const context = useContext(TreeNodeContext);

  if (group !== undefined) {
    context.group = group;
  }

  if (disabled !== undefined) {
    context.disabled = disabled;
  }

  if (loading !== undefined) {
    context.loading = loading;
  }

  if (selected !== undefined) {
    context.selected = selected;
  }

  if (filterValue !== undefined) {
    context.filterValue = filterValue;
  }

  if (expanded !== undefined) {
    context.expanded = expanded;
  }

  if (leaf !== undefined) {
    context.leaf = leaf;
  }

  if (externalExpanded !== undefined) {
    context.externalExpanded = externalExpanded;
  }

  const handleEnter = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (EventContext.has(event, EventTreeNodeExpandFlag, EventTreeNodeSelectFlag, EventStopPropagationFlag)) {
      return;
    }

    EventContext.set(event, EventTreeNodeSelectFlag);
    switch ((event as unknown as KeyboardEvent).code) {
      case KEY.ENTER:
        context.select(event.ctrlKey || event.metaKey);
        break;
    }
    return true;
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (onClick) {
      onClick(event);
    }

    if (EventContext.has(event, EventTreeNodeExpandFlag, EventTreeNodeSelectFlag, EventStopPropagationFlag)) {
      return;
    }

    context.click?.();
  };

  const handleDbClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (EventContext.has(event, EventTreeNodeExpandFlag, EventTreeNodeSelectFlag, EventStopPropagationFlag)) {
      return;
    }
    context.open();
  };

  return (
    <div
      tabIndex={0}
      aria-selected={context.selected}
      className={className}
      onClick={handleClick}
      onKeyDown={handleEnter}
      onDoubleClick={handleDbClick}
    >
      {children}
    </div>
  );
});
