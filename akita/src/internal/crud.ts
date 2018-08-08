import { Entities, EntityState, HashMap, ID, Newable } from '../api/types';
import { assertEntityExists, assertEntityState } from './error';
import { entityExists, isFunction, isPlainObject, resetActive } from './utils';

export class CRUD {
  _set<S, E>(state: S, entities: E[] | HashMap<E> | Entities<E>, entityClass: Newable<E>, idKey): S {
    let ids, normalized;

    if ((entities as Entities<E>).ids && (entities as Entities<E>).entities) {
      ids = (entities as Entities<E>).ids;
      normalized = (entities as Entities<E>).entities;
    } else {
      const isArray = Array.isArray(entities);
      normalized = entities;

      if (isArray) {
        normalized = this.keyBy(entities as E[], entityClass, idKey) as E[];
      } else {
        assertEntityState(entities);
      }

      ids = isArray ? (entities as E[]).map(entity => entity[idKey]) : Object.keys(normalized as HashMap<E>).map(id => entities[id][idKey]);
    }

    const newState = {
      ...(state as any),
      entities: normalized,
      ids
    };

    if (resetActive(newState)) {
      newState.active = null;
    }

    return newState;
  }

  _replaceEntity<T extends EntityState>(state: T, id: ID, entity): T {
    return {
      ...(state as any),
      entities: {
        ...state.entities,
        [id]: entity
      }
    };
  }

  _add<S extends EntityState, E>(state: S, entities: E[], idKey): S {
    let addedEntities = {};
    let addedIds = [];

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const entityId = entity[idKey];

      if (!entityExists(entityId, state.entities)) {
        addedEntities[entityId] = entity;
        addedIds.push(entityId);
      }
    }

    return {
      ...(state as any),
      entities: {
        ...state.entities,
        ...addedEntities
      },
      ids: [...state.ids, ...addedIds]
    };
  }

  _update<T extends EntityState>(state: T, ids: ID[], newStateOrFn: object | ((e: Readonly<any>) => object)): T {
    const updatedEntities = {};

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      assertEntityExists(id, state.entities);

      const oldEntity = state.entities[id];
      const newState = isFunction(newStateOrFn) ? newStateOrFn(oldEntity) : newStateOrFn;

      let newEntity;

      const merged = {
        ...oldEntity,
        ...newState
      };

      if (isPlainObject(oldEntity)) {
        newEntity = merged;
      } else {
        newEntity = new oldEntity.constructor(merged);
      }

      updatedEntities[id] = newEntity;
    }

    return {
      ...(state as any),
      entities: {
        ...state.entities,
        ...updatedEntities
      }
    };
  }

  _remove<T extends EntityState>(state: T, ids: ID[] | null): T {
    if (!ids) return this._removeAll(state);

    const removed = ids.reduce((acc, id) => {
      const { [id]: entity, ...rest } = acc;
      return rest;
    }, state.entities);
    const newState = {
      ...(state as any),
      entities: removed,
      ids: state.ids.filter(current => ids.indexOf(current) === -1)
    };

    if (resetActive(newState)) {
      newState.active = null;
    }

    return newState;
  }

  private _removeAll<T extends EntityState>(state: T): T {
    const newState = {
      ...(state as any),
      entities: {},
      ids: [],
      active: null
    };

    return newState;
  }

  private keyBy(entities: any[], entityClass?: Newable<any>, id = 'id') {
    const acc = {};

    for (let i = 0, len = entities.length; i < len; i++) {
      const entity = entities[i];
      acc[entity[id]] = entityClass ? new entityClass(entity) : entity;
    }

    return acc;
  }
}

export const _crud = new CRUD();
