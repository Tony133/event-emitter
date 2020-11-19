import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { EventEmitter2 } from 'eventemitter2';
import { EventsMetadataAccessor } from './events-metadata.accessor';

@Injectable()
export class EventSubscribersLoader implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metadataAccessor: EventsMetadataAccessor,
    private readonly metadataScanner: MetadataScanner,
  ) {}

  onModuleInit() {
    this.loadEventListeners();
  }

  onModuleDestroy() {
    this.eventEmitter.removeAllListeners();
  }

  loadEventListeners() {
    const providers = this.discoveryService.getProviders();
    providers
      .filter(wrapper => wrapper.isDependencyTreeStatic())
      .filter(wrapper => wrapper.instance)
      .forEach((wrapper: InstanceWrapper) => {
        const { instance } = wrapper;

        const prototype = Object.getPrototypeOf(instance);
        this.metadataScanner.scanFromPrototype(
          instance,
          prototype,
          (methodKey: string) =>
            this.subscribeToEventIfListener(instance, methodKey),
        );
      });
  }

  private subscribeToEventIfListener(
    instance: Record<string, any>,
    methodKey: string,
  ) {
    const eventListenerMetadata = this.metadataAccessor.getEventHandlerMetadata(
      instance[methodKey],
    );
    if (!eventListenerMetadata) {
      return;
    }
    const { event, options } = eventListenerMetadata;
    this.eventEmitter.on(
      event,
      (...args: unknown[]) => instance[methodKey].call(instance, ...args),
      options,
    );
  }
}