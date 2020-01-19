import React, { useReducer, useState, useEffect, useRef } from 'react';
import { clone } from 'ramda';
import PropTypes from 'prop-types';
import { createEntryFacade, createGroupFacade } from '@buttercup/facades';
import { VaultFacade } from './props';
import { entryReducer } from './reducers/entry';
import { vaultReducer, filterReducer, defaultFilter } from './reducers/vault';
import { useDeepEffect } from './hooks/compare';
import { hashVaultFacade } from '@buttercup/facades';

export const VaultContext = React.createContext();

export const VaultProvider = ({ onUpdate, vault: vaultSource, children }) => {
  const [vault, dispatch] = useReducer(vaultReducer, clone(vaultSource));
  const [selectedGroupID, setSelectedGroupID] = useState(vault.groups[0].id);
  const [selectedEntryID, setSelectedEntryID] = useState(null);
  const [editingEntry, dispatchEditing] = useReducer(entryReducer, null);
  const [groupFilters, dispatchGroupFilters] = useReducer(filterReducer, defaultFilter);
  const [entriesFilters, dispatchEntriesFilters] = useReducer(filterReducer, defaultFilter);
  const [expandedGroups, setExpandedGroups] = useState([]);
  const initRef = useRef(false);

  const selectedEntry = vault.entries.find(entry => entry.id === selectedEntryID);
  const currentEntries = vault.entries.filter(entry => entry.parentID === selectedGroupID);

  useDeepEffect(() => {
    if (initRef.current === false) {
      initRef.current = true;
      return;
    }
    if (hashVaultFacade(vaultSource) === hashVaultFacade(vault)) {
      // We only call external on-update if the vaults are actually different..
      // If they remain the same (identical hash) then there's no need to save
      // the facade to the vault.
      return;
    }
    onUpdate(vault);
  }, [vault]);

  const context = {
    vault,
    currentEntries,
    selectedEntry,
    editingEntry,
    selectedEntryID,
    selectedGroupID,
    expandedGroups,
    groupFilters,
    entriesFilters,

    // Actions
    batchDeleteItems: ({ groupIDs = [], entryIDs = [] }) => {
      dispatch({
        type: 'batch-delete',
        groups: groupIDs,
        entries: entryIDs
      });
    },
    onSelectGroup: groupID => {
      setSelectedGroupID(groupID);
      setSelectedEntryID(null);
    },
    handleExpandGroup: group => {
      setExpandedGroups([...expandedGroups, group.id]);
    },
    handleCollapseGroup: group => {
      setExpandedGroups(expandedGroups.filter(id => id !== group.id));
    },
    onCreateGroup: (parentID, groupTitle) => {
      const parentGroupID = parentID ? parentID : undefined;
      const group = createGroupFacade(null, parentGroupID);
      group.title = groupTitle;
      dispatch({
        type: 'create-group',
        payload: group
      });
    },
    onGroupFilterTermChange: term => {
      dispatchGroupFilters({
        type: 'set-term',
        term
      });
    },
    onGroupFilterSortModeChange: sortMode => {
      dispatchGroupFilters({
        type: 'set-sort-mode',
        sortMode
      });
    },
    onEntriesFilterTermChange: term => {
      dispatchEntriesFilters({
        type: 'set-term',
        term
      });
    },
    onEntriesFilterSortModeChange: sortMode => {
      dispatchEntriesFilters({
        type: 'set-sort-mode',
        sortMode
      });
    },
    onMoveEntryToGroup: (entryID, parentID) => {
      dispatch({
        type: 'move-entry',
        entryID,
        parentID
      });
      if (editingEntry && entryID === editingEntry.id) {
        dispatchEditing({
          type: 'stop-editing'
        });
      }
    },
    onMoveGroup: (groupID, parentID) => {
      dispatch({
        type: 'move-group',
        groupID,
        parentID
      });
    },
    onRenameGroup: (groupID, title) => {
      dispatch({
        type: 'rename-group',
        groupID,
        title
      });
    },
    onAddEntry: type => {
      const facade = createEntryFacade(null, { type });
      facade.parentID = selectedGroupID;
      facade.id = null;
      facade.isNew = true;
      dispatchEditing({
        type: 'set-entry',
        payload: facade
      });
      setSelectedEntryID(null);
    },
    onDeleteEntry: entryID => {
      dispatch({
        type: 'delete-entry',
        entryID
      });
      dispatchEditing({
        type: 'stop-editing'
      });
    },
    onEdit: () => {
      if (!selectedEntry) {
        return;
      }
      dispatchEditing({
        type: 'set-entry',
        payload: clone(selectedEntry)
      });
      setSelectedEntryID(null);
    },
    onSaveEdit: () => {
      if (!editingEntry) {
        return;
      }
      dispatch({
        type: 'save-entry',
        entry: editingEntry
      });
      dispatchEditing({
        type: 'stop-editing'
      });
      if (editingEntry.id) {
        setSelectedEntryID(editingEntry.id);
      }
    },
    onCancelEdit: () => {
      dispatchEditing({
        type: 'stop-editing'
      });
      if (editingEntry.id) {
        setSelectedEntryID(editingEntry.id);
      }
    },
    onSelectEntry: entryID => {
      if (editingEntry) {
        return;
      }
      setSelectedEntryID(entryID);
    },
    onAddField: () => {
      dispatchEditing({
        type: 'add-field'
      });
    },
    onFieldUpdate: (changedField, value) => {
      dispatchEditing({
        type: 'update-field',
        field: changedField,
        value
      });
    },
    onFieldUpdateInPlace: (entryID, field, value) => {
      dispatch({
        type: 'set-entry-field',
        entryID,
        field,
        value
      });
    },
    onFieldSetValueType: (changedField, valueType) => {
      dispatchEditing({
        type: 'set-field-value-type',
        field: changedField,
        valueType
      });
    },
    onFieldNameUpdate: (changedField, property) => {
      dispatchEditing({
        type: 'update-field',
        field: changedField,
        property
      });
    },
    onRemoveField: field => {
      dispatchEditing({
        type: 'remove-field',
        field
      });
    }
  };
  return <VaultContext.Provider value={context}>{children}</VaultContext.Provider>;
};

VaultProvider.propTypes = {
  onUpdate: PropTypes.func.isRequired,
  vault: VaultFacade.isRequired
};

VaultProvider.defaultProps = {
  onUpdate: () => {}
};
