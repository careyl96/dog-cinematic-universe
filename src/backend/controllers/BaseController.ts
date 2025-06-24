import { EntityManager, Repository } from 'typeorm'
import { AppDataSource } from '../db/data-source'

type EntityClass<T> = { new (): T }

type ControllerConstructor<T, C> = new (entityClass: EntityClass<T>, manager: EntityManager) => C

export class BaseController<T> {
  protected repo: Repository<T>

  constructor(
    protected entityClass: EntityClass<T>,
    protected manager: EntityManager
  ) {
    const effectiveManager = manager ?? AppDataSource.manager
    this.repo = effectiveManager.getRepository(entityClass)
  }

  withManager(manager: EntityManager): this {
    const ControllerClass = this.constructor as ControllerConstructor<T, this>
    return new ControllerClass(this.entityClass, manager)
  }
}
