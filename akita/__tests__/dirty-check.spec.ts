import { DirtyCheckPlugin, EntityDirtyCheckPlugin } from '../src/index';
import { Widget, WidgetsQuery, WidgetsStore } from './setup';
import { Observable } from 'rxjs';

describe('DirtyCheck', () => {
  function createWidget() {
    return {
      id: ++_id,
      title: `Widget ${_id}`
    } as Widget;
  }

  let _id = 0;
  const widgetsStore = new WidgetsStore();
  const widgetsQuery = new WidgetsQuery(widgetsStore);

  it('should call activate only on first setHead()', () => {
    spyOn(DirtyCheckPlugin.prototype, 'activate');
    const dirtyCheck = new DirtyCheckPlugin(widgetsQuery);

    expect(DirtyCheckPlugin.prototype.activate).not.toHaveBeenCalled();
    dirtyCheck.setHead();
    expect(DirtyCheckPlugin.prototype.activate).toHaveBeenCalledTimes(1);
    dirtyCheck.setHead();
    expect(DirtyCheckPlugin.prototype.activate).toHaveBeenCalledTimes(1);
  });

  describe('Plugin flow', () => {
    const dirtyCheck = new DirtyCheckPlugin(widgetsQuery);
    const spy = jest.fn();

    dirtyCheck.isDirty$.subscribe(spy);

    it('should setHead()', () => {
      widgetsStore.add(createWidget());
      expect(spy).toHaveBeenLastCalledWith(false);
      dirtyCheck.setHead();
      expect(dirtyCheck.head).toEqual({
        entities: {
          '1': {
            id: 1,
            title: 'Widget 1'
          }
        },
        error: null,
        ids: [1],
        loading: true
      });
      expect(spy).toHaveBeenLastCalledWith(false);
    });

    it("should mark as dirty when the store value doesn't equal to head", () => {
      widgetsStore.add(createWidget());
      expect(spy).toHaveBeenLastCalledWith(true);
    });

    it('should mark as pristine when the store value equal to head', () => {
      widgetsStore.remove(2);
      expect(spy).toHaveBeenLastCalledWith(false);
    });

    it('should rebase the head', () => {
      widgetsStore.add(createWidget());
      expect(spy).toHaveBeenLastCalledWith(true);
      dirtyCheck.setHead();
      expect(spy).toHaveBeenLastCalledWith(false);
      expect(dirtyCheck.head).toEqual({
        entities: {
          '1': {
            id: 1,
            title: 'Widget 1'
          },
          '3': {
            id: 3,
            title: 'Widget 3'
          }
        },

        error: null,
        ids: [1, 3],
        loading: true
      });
    });

    it('should reset the store to current head value', () => {
      widgetsStore.add(createWidget());
      expect(spy).toHaveBeenLastCalledWith(true);
      dirtyCheck.reset();
      expect(widgetsStore._value()).toEqual({
        entities: {
          '1': {
            id: 1,
            title: 'Widget 1'
          },
          '3': {
            id: 3,
            title: 'Widget 3'
          }
        },
        error: null,
        ids: [1, 3],
        loading: true
      });

      expect(spy).toHaveBeenLastCalledWith(false);
    });

    it('should unsubscribe on destroy', () => {
      dirtyCheck.destroy();
      expect(dirtyCheck.subscription.closed).toBeTruthy();
    });

    it('should return true if state is dirty', () => {
      dirtyCheck.updateDirtiness(true);
      const isDirty = dirtyCheck.isDirty();
      expect(isDirty).toBeTruthy();
    });

    it('should return false if state is not dirty', () => {
      dirtyCheck.updateDirtiness(false);
      const isDirty = dirtyCheck.isDirty();
      expect(isDirty).toBeFalsy();
    });

    it('should return true if state has head', () => {
      dirtyCheck.setHead();
      const isDirty = dirtyCheck.hasHead();
      expect(isDirty).toBeTruthy();
    });

    it('should return false if state does not has head', () => {
      dirtyCheck.head = null;
      const hasHead = dirtyCheck.hasHead();
      expect(hasHead).toBeFalsy();
    });
  });
});

describe('DirtyCheckEntity', () => {
  function createWidget(complete = false) {
    return {
      id: ++_id,
      title: `Widget ${_id}`,
      complete
    } as Widget;
  }

  let _id = 0;
  const widgetsStore = new WidgetsStore();
  const widgetsQuery = new WidgetsQuery(widgetsStore);
  const collection = new EntityDirtyCheckPlugin(widgetsQuery);
  widgetsStore.add([createWidget(), createWidget(), createWidget()]);
  collection.setHead();

  it('should select all when not passing entityIds', () => {
    expect(collection.entities.size).toEqual(3);
  });

  it('should work with entity', () => {
    const spy = jest.fn();
    collection.isDirty(1).subscribe(spy);
    expect(spy).toHaveBeenLastCalledWith(false);
    widgetsStore.update(2, { title: 'Changed' });
    expect(spy).toHaveBeenLastCalledWith(false);
    widgetsStore.update(1, { title: 'Changed' });
    expect(spy).toHaveBeenLastCalledWith(true);
    widgetsStore.update(1, { title: 'Widget 1' });
    expect(spy).toHaveBeenLastCalledWith(false);
    widgetsStore.update(1, { title: 'Changed' });
    expect(spy).toHaveBeenLastCalledWith(true);
    expect(widgetsQuery.getEntity(1)).toEqual({ id: 1, title: 'Changed', complete: false });
    collection.reset(1);
    expect(widgetsQuery.getEntity(1)).toEqual({ id: 1, title: 'Widget 1', complete: false });
    widgetsStore.update(1, { title: 'Changed', complete: true });
    expect(widgetsQuery.getEntity(1)).toEqual({ id: 1, title: 'Changed', complete: true });
    const updateFn = (head, current) => {
      return {
        ...head,
        title: current.title
      };
    };
    collection.reset(1, { updateFn });
    expect(widgetsQuery.getEntity(1)).toEqual({ id: 1, title: 'Changed', complete: false });
    expect(spy).toHaveBeenLastCalledWith(true);
  });

  it('should return true if some of the entities are dirty', () => {
    widgetsStore.remove();
    widgetsStore.add([createWidget(), createWidget(), createWidget()]);
    collection.setHead();
    const spy = jest.fn();
    collection.isSomeDirty().subscribe(spy);
    expect(spy).toHaveBeenLastCalledWith(false);
    widgetsStore.update(5, { title: 'Changed' });
    expect(spy).toHaveBeenLastCalledWith(true);
    widgetsStore.update(4, { title: 'Changed' });
    expect(spy).toHaveBeenLastCalledWith(true);
    widgetsStore.update(4, { title: 'Widget 4' });
    expect(spy).toHaveBeenLastCalledWith(true);
    widgetsStore.update(5, { title: 'Widget 5' });
    expect(spy).toHaveBeenLastCalledWith(false);
  });

  it('should return isDirty as observable by default', () => {
    const widget = createWidget();
    widgetsStore.add(widget);
    const isDirty = collection.isDirty(widget.id);
    expect(isDirty).toBeInstanceOf(Observable);
  });

  it('should return isDirty as observable', () => {
    const widget = createWidget();
    widgetsStore.add(widget);
    const isDirty = collection.isDirty(widget.id, true);
    expect(isDirty).toBeInstanceOf(Observable);
  });

  it('should return isDirty as boolean', () => {
    const widget = createWidget();
    widgetsStore.add(widget);
    const isDirty = collection.isDirty(widget.id, false);
    expect(typeof isDirty).toEqual('boolean');
  });

  it('should return false for hasHead()', () => {
    const widget = createWidget();
    widgetsStore.add(widget);
    expect(collection.hasHead(widget.id)).toBeFalsy();
  });

  it('should return true for hasHead()', () => {
    const widget = createWidget();
    widgetsStore.add(widget);
    collection.setHead(widget.id);
    expect(collection.hasHead(widget.id)).toBeTruthy();
  });
});
