
  [![NPM Version](https://img.shields.io/npm/v/futoin-eventstream.svg?style=flat)](https://www.npmjs.com/package/futoin-eventstream)
  [![NPM Downloads](https://img.shields.io/npm/dm/futoin-eventstream.svg?style=flat)](https://www.npmjs.com/package/futoin-eventstream)
  [![Build Status](https://travis-ci.org/futoin/core-js-ri-eventstream.svg?branch=master)](https://travis-ci.org/futoin/core-js-ri-eventstream)
  [![stable](https://img.shields.io/badge/stability-stable-green.svg?style=flat)](https://www.npmjs.com/package/futoin-eventstream)

  [![NPM](https://nodei.co/npm/futoin-eventstream.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/futoin-eventstream/)


# About

FutoIn EventStream is fundamental part for efficient global state update in
distributed systems. It is used for reliable event delivery, decentralized cache
invalidation, efficient online segregation of active and warehouse data.

Unlike various message/event brokers, the focus of FutoIn Event Stream is integration
with database transactions for reliable efficient event recording and delivery.

The design is not focused on high throughput as the primary reason is reliable association of events
with database changes. Please consider using pure message brokers for throughput-intensive cases.

**Documentation** --> [FutoIn Guide](https://futoin.org/docs/eventstream/)

Reference implementation of:
 
    FTN18: FutoIn Interface - Event Stream
    Version: 1.1
    
* Spec: [FTN18: FutoIn Interface - Event Stream v1.x](http://specs.futoin.org/final/preview/ftn18_if_eventstream-1.html)

## Features

* Database transaction-bound event generation.
* Standalone event generation.
* Event polling for simple, but less efficient solutions.
* Event pushing for advanced efficient cases.

## Supported database types

* MySQL
* PostgreSQL
* SQLite
* Potentially, any other SQL-compliant supported by `futoin-database`


# Installation for Node.js

Command line:
```sh
$ yarn add futoin-eventstream 
```
or
```sh
$ npm install futoin-eventstream --save
```


# Concept

Each event has auto-generated ID, type, data and timestamp. Type is all upper case identifier.
Data is arbitrary JSON-friendly data.

Two configurable delivery strategies are supported: polling and streaming, but consumer
acts as client in both cases.

There are two delivery modes: reliable and live. The later allow messages to be skipped.
To ensure that events are reliably delivered, each consumer must register first.

Two message storage types are assumed: active small high performance area and slower data warehouse
for all time history. DBEventArchiver tool is provided for efficient reliable data transfer.

More detailed concept is in the FTN18 spec.


# Examples

## 1. Adding standalone events

```javascript
GenFace.register(as, ccm, 'evtgen', endpoint );
// ...
const evtgen = ccm.iface('evtgen');
evtgen.addEvent(as, 'NULL_EVENT');
evtgen.addEvent(as, 'INT_EVENT', 123);
evtgen.addEvent(as, 'STR_EVENT', 'Some Str');
evtgen.addEvent(as, 'ARRAY_EVENT', [1, 2, 3]);
evtgen.addEvent(as, 'OBJECT_EVENT', { a: 1, b: 2, c: 3 });
```

## 2. Adding events in database transaction

For more advanced cases, you can check source code of DBGenFace#addXferEvent()
to build more tailored statements.

```javascript
DBGenFace.register(as, ccm, 'evtgen', endpoint );
// ...
const evtgen = ccm.iface('evtgen');
const db = ccm.db();

const xfer = db.newXfer();
xfer.insert('SomeTable').set('name', 'Name');
evtgen.addXferEvent(xfer, 'NEW_ENTRY', {name: 'Name'});
xfer.execute(as);
```

## 3. Poll for events with different components & filters

Each consumer is identifier by credentials + arbitrary component name.

As special "LIVE" component can be used for unreliable delivery.

```javascript
PollFace.register(as, ccm, 'evtpoll', endpoint );
// ...
const evtpoll = ccm.iface('evtpoll');

// User info polling
evtpoll.registerConsumer(as, 'Security');
evtpoll.pollEvents(as, 'Security', last_known_id_here, ['USR_ADD', 'USR_MOD', 'USR_LOGIN']);
as.add((as, events) => {
    // ....
});

// Anti-Fraud processing
evtpoll.registerConsumer(as, 'AntiFraud');
evtpoll.pollEvents(as, 'AntiFraud', last_known_id_here, ['DEPOSIT', 'WITHDRAW', 'XFER']);
as.add((as, events) => {
    // ....
});
```

## 4. Event push with different components & filters

A child class of ReliableReceiverService should be created to properly
handle incoming events.

A bi-directional channel like WebSockets or Internal must be used.

A separate Executor instance should be created for use in endpoint callbacks.

```javascript
class UserReceiver extends ReliableReceiverService
{
    _onEvents( as, reqinfo, events ) {
        // ...
    }
}

const executor = Executor(ccm);
PollFace.register(as, ccm, 'evtpushsec', endpoint, credentials, { executor } );
UserReceiver.register(as, executor);

const evtpushsec = ccm.iface('evtpushsec');
evtpushsec.registerConsumer(as, 'Security');
evtpushsec.readyToReceive(as, 'Security', ['USR_ADD', 'USR_MOD', 'USR_LOGIN']);
```

## 5. Event history transfer

There should be a single system-wide instance of DBEventArchiver tool.
The tool will automatically reconnect on errors. Processing state
can be monitored through events.

```javascript
DBAutoConfig(as, ccm, {
    evtdwh: {}
});
const archiver = new DBEventArchiver(ccm);

archiver.on('workerError', () => { ... });
archiver.on('receiverError', () => { ... });
archiver.on('newEvents', () => { ... });

// keep going until stopped
archiver.start(push_endpoint, credentials);

// to stop - automatically called on ccm.close()
archiver.stop();
```

## 6. Discarding event from active database

For performance and disaster recovery time reasons, operation critical
database should be kept as small as possible. Events delivered to all consumers
including DBEventArchiver can be removed the following way.

```javascript
DBAutoConfig(as, ccm, {
    evt: {}
});
const discarder = new DBEventDiscarder(ccm);

archiver.on('workerError', () => { ... });
archiver.on('eventDiscard', () => { ... });

// keep going until stopped
discarder.start(ccm);

// to stop - automatically called on ccm.close()
discarder.stop();
```

## 7. Complete example

DBPushService inherits DBPollService, so there is no need to instance both.

This case show internal communicaton channel.

```javascript
const ccm = new AdvancedCCM();
DBAutoConfig(as, ccm, {
    evt: {}
});
const executor = new Executor(ccm); // or NodeExecutor() for WebSockets
DBGenService.register(as, executor);
DBPushService.register(as, executor);

GenFace.register(as, ccm, 'evtgen', executor);
PollFace.register(as, ccm, 'evtpoll', executor);

const p = as.parallel();

p.loop( (as) => {
    ccm.iface('evtgen').addEvent(as, 'EVT', 'data');
});

p.add( (as) => {
    let last_id = null;
    
    as.loop( (as) => {
        ccm.iface('evtpoll').pollEvents(as, 'LIVE', last_id);
        
        as.add((as, events) => {
            if (events.length) {
                last_id = events[events.length - 1].id;
            } else {
                const timer = setTimeout( () => as.success(), 1e3 );
                as.setCancel((as) => clearTimeout(timer));
            }
        });
    });
});
```


    
# API documentation

The concept is described in FutoIn specification: [FTN18: FutoIn Interface - Event Stream v1.x](http://specs.futoin.org/final/preview/ftn18_if_eventstream-1.html)

## Classes

<dl>
<dt><a href="#DBEventArchiver">DBEventArchiver</a></dt>
<dd><p>Database Event Archiver service.</p>
</dd>
<dt><a href="#DBEventDiscarder">DBEventDiscarder</a></dt>
<dd><p>DB-specific event discarding.</p>
<p>It&#39;s assumed to be run against &quot;active&quot; database part as defined in the concept
to reduce its size after all reliably delivered events are delivered to consumers.</p>
<p>Event are deleted based on limit_at_once to avoid too large transactions which
may affect performance of realtime processes and break some DB clusters like Galera.</p>
</dd>
<dt><a href="#DBGenFace">DBGenFace</a></dt>
<dd><p>GenFace for DB backend.</p>
<p>The only difference to original GenFace is native DB-specific API.</p>
</dd>
<dt><a href="#DBGenService">DBGenService</a></dt>
<dd><p>Database-specific event generation service</p>
</dd>
<dt><a href="#DBPollService">DBPollService</a></dt>
<dd><p>Database-based Poll Service</p>
</dd>
<dt><a href="#DBPushService">DBPushService</a></dt>
<dd><p>Database-specific Push Service</p>
</dd>
<dt><a href="#DBServiceApp">DBServiceApp</a></dt>
<dd><p>All-in-one DB EventStream initialization</p>
</dd>
<dt><a href="#GenFace">GenFace</a></dt>
<dd><p>Event Stream - Generator Face</p>
</dd>
<dt><a href="#GenService">GenService</a></dt>
<dd><p>Event Stream - Generator Service Base</p>
</dd>
<dt><a href="#LiveReceiver">LiveReceiver</a></dt>
<dd><p>Reliable Event Receiver helper to minimize boilerplate code in projects.</p>
</dd>
<dt><a href="#PollFace">PollFace</a></dt>
<dd><p>Event Stream - Poll Face</p>
</dd>
<dt><a href="#PollService">PollService</a></dt>
<dd><p>Event Stream - Poll Service Base</p>
</dd>
<dt><a href="#PushFace">PushFace</a></dt>
<dd><p>Event Stream - Push Face</p>
</dd>
<dt><a href="#PushService">PushService</a></dt>
<dd><p>Event Stream - Push Service Base</p>
</dd>
<dt><a href="#ReceiverFace">ReceiverFace</a></dt>
<dd><p>Event Stream - Receiver Face</p>
</dd>
<dt><a href="#ReceiverService">ReceiverService</a></dt>
<dd><p>Base implementation for receiver side</p>
</dd>
<dt><a href="#ReliableReceiver">ReliableReceiver</a></dt>
<dd><p>Reliable Event Receiver helper to minimize boilerplate code in projects.</p>
</dd>
<dt><a href="#ReliableReceiverService">ReliableReceiverService</a></dt>
<dd><p>Base implementation for reliable receiver side.</p>
</dd>
</dl>

<a name="DBEventArchiver"></a>

## DBEventArchiver
Database Event Archiver service.

**Kind**: global class  
**Note**: No more than one instance should run at once.  
<a name="new_DBEventArchiver_new"></a>

### new DBEventArchiver(db_ccm)
C-tor


| Param | Type | Description |
| --- | --- | --- |
| db_ccm | <code>AdvancedCCM</code> | CCM instance with registered '#db.evtdwh' interface |

<a name="DBEventDiscarder"></a>

## DBEventDiscarder
DB-specific event discarding.

It's assumed to be run against "active" database part as defined in the concept
to reduce its size after all reliably delivered events are delivered to consumers.

Event are deleted based on limit_at_once to avoid too large transactions which
may affect performance of realtime processes and break some DB clusters like Galera.

**Kind**: global class  

* [DBEventDiscarder](#DBEventDiscarder)
    * [.start(ccm, [options])](#DBEventDiscarder+start)
    * [.stop()](#DBEventDiscarder+stop)
    * ["workerError"](#DBEventDiscarder+event_workerError)
    * ["eventDiscard"](#DBEventDiscarder+event_eventDiscard)

<a name="DBEventDiscarder+start"></a>

### dbEventDiscarder.start(ccm, [options])
Start event discarding

**Kind**: instance method of [<code>DBEventDiscarder</code>](#DBEventDiscarder)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| ccm | <code>AdvancedCCM</code> |  | CCM with registered #db.evt interface |
| [options] | <code>object</code> | <code>{}</code> | options |
| [options.poll_period_ms] | <code>integer</code> | <code>600e3</code> | poll interval |
| [options.limit_at_once] | <code>integer</code> | <code>1000</code> | events to delete at once |
| [options.event_table] | <code>string</code> | <code>&quot;default&quot;</code> | events table |
| [options.consumer_table] | <code>string</code> | <code>&quot;default&quot;</code> | consumers table |

<a name="DBEventDiscarder+stop"></a>

### dbEventDiscarder.stop()
Stop event discarding

**Kind**: instance method of [<code>DBEventDiscarder</code>](#DBEventDiscarder)  
<a name="DBEventDiscarder+event_workerError"></a>

### "workerError"
Emitted on worker errors

**Kind**: event emitted by [<code>DBEventDiscarder</code>](#DBEventDiscarder)  
<a name="DBEventDiscarder+event_eventDiscard"></a>

### "eventDiscard"
Emitted on discarded events

**Kind**: event emitted by [<code>DBEventDiscarder</code>](#DBEventDiscarder)  
<a name="DBGenFace"></a>

## DBGenFace
GenFace for DB backend.

The only difference to original GenFace is native DB-specific API.

**Kind**: global class  

* [DBGenFace](#DBGenFace)
    * [.DB_EVENT_TABLE](#DBGenFace+DB_EVENT_TABLE) ⇒ <code>string</code>
    * [.addXferEvent(xb, type, data, [table])](#DBGenFace+addXferEvent)

<a name="DBGenFace+DB_EVENT_TABLE"></a>

### dbGenFace.DB_EVENT_TABLE ⇒ <code>string</code>
Easy access to DB event table name

**Kind**: instance property of [<code>DBGenFace</code>](#DBGenFace)  
**Returns**: <code>string</code> - raw table name  
<a name="DBGenFace+addXferEvent"></a>

### dbGenFace.addXferEvent(xb, type, data, [table])
Helper to add event generation into DB transaction

**Kind**: instance method of [<code>DBGenFace</code>](#DBGenFace)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| xb | <code>XferBuilder</code> |  | instance of transaction builder |
| type | <code>string</code> |  | event type |
| data | <code>\*</code> |  | any data |
| [table] | <code>string</code> | <code>&quot;evt_queue&quot;</code> | event queue |

<a name="DBGenService"></a>

## DBGenService
Database-specific event generation service

**Kind**: global class  
<a name="new_DBGenService_new"></a>

### new DBGenService(_as, executor, [options])
Please use DBGenService.regster()


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| _as | <code>AsyncSteps</code> |  | async step interface |
| executor | <code>Executor</code> |  | related Executor |
| [options] | <code>object</code> | <code>{}</code> | options |
| [options.event_table] | <code>string</code> | <code>&quot;default&quot;</code> | events table |

<a name="DBPollService"></a>

## DBPollService
Database-based Poll Service

**Kind**: global class  
<a name="new_DBPollService_new"></a>

### new DBPollService(as, executor, [options])
Please use DBPollService,register()


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | async step interface |
| executor | <code>Executor</code> |  | related Executor |
| [options] | <code>object</code> | <code>{}</code> | options |
| [options.event_table] | <code>string</code> | <code>&quot;default&quot;</code> | events table |
| [options.consumer_table] | <code>string</code> | <code>&quot;default&quot;</code> | consumers table |

<a name="DBPushService"></a>

## DBPushService
Database-specific Push Service

**Kind**: global class  
<a name="new_DBPushService_new"></a>

### new DBPushService(as, executor, [options])
Please use DBPushService,register()


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | async step interface |
| executor | <code>Executor</code> |  | related Executor |
| [options] | <code>object</code> | <code>{}</code> | options |
| [options.event_table] | <code>string</code> | <code>&quot;default&quot;</code> | events table |
| [options.consumer_table] | <code>string</code> | <code>&quot;default&quot;</code> | consumers table |
| [options.sleep_min] | <code>integer</code> | <code>100</code> | minimal sleep on lack of events |
| [options.sleep_max] | <code>integer</code> | <code>3000</code> | maximal sleep on lack of events |
| [options.sleep_step] | <code>integer</code> | <code>100</code> | sleep time increase on lack of events |

<a name="DBServiceApp"></a>

## DBServiceApp
All-in-one DB EventStream initialization

**Kind**: global class  

* [DBServiceApp](#DBServiceApp)
    * [new DBServiceApp(as, options)](#new_DBServiceApp_new)
    * [.ccm()](#DBServiceApp+ccm) ⇒ <code>AdvancedCCM</code>
    * [.executor()](#DBServiceApp+executor) ⇒ <code>Executor</code>
    * [.close([done])](#DBServiceApp+close)

<a name="new_DBServiceApp_new"></a>

### new DBServiceApp(as, options)
C-tor


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | AsyncSteps interface |
| options | <code>object</code> | <code>{}</code> | options |
| [options.ccm] | <code>AdvancedCCM</code> |  | external CCM instance |
| [options.executor] | <code>Executor</code> |  | external private executor instance |
| [options.ccmOptions] | <code>object</code> |  | auto-CCM options |
| [options.notExpectedHandler] | <code>callable</code> |  | 'notExpected' error handler |
| [options.executorOptions] | <code>object</code> |  | private auto-Executor options |
| [options.evtOptions] | <code>object</code> |  | eventstream options |
| [options.discarderOptions] | <code>object</code> |  | discarder options |
| [options.enableDiscarder] | <code>boolean</code> |  | enable discarder, if true |
| [options.archiverOptions] | <code>object</code> |  | discarder options |
| [options.enableArchiver] | <code>boolean</code> |  | enable archiver, if true |

<a name="DBServiceApp+ccm"></a>

### dbServiceApp.ccm() ⇒ <code>AdvancedCCM</code>
CCM instance accessor

**Kind**: instance method of [<code>DBServiceApp</code>](#DBServiceApp)  
**Returns**: <code>AdvancedCCM</code> - instance  
<a name="DBServiceApp+executor"></a>

### dbServiceApp.executor() ⇒ <code>Executor</code>
Executor instance accessor

**Kind**: instance method of [<code>DBServiceApp</code>](#DBServiceApp)  
**Returns**: <code>Executor</code> - instance  
<a name="DBServiceApp+close"></a>

### dbServiceApp.close([done])
Shutdown of app and related instances

**Kind**: instance method of [<code>DBServiceApp</code>](#DBServiceApp)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [done] | <code>callable</code> | <code></code> | done callback |

<a name="GenFace"></a>

## GenFace
Event Stream - Generator Face

**Kind**: global class  

* [GenFace](#GenFace)
    * [.LATEST_VERSION](#GenFace.LATEST_VERSION)
    * [.PING_VERSION](#GenFace.PING_VERSION)
    * [.register(as, ccm, name, endpoint, [credentials], [options])](#GenFace.register)

<a name="GenFace.LATEST_VERSION"></a>

### GenFace.LATEST_VERSION
Latest supported FTN17 version

**Kind**: static property of [<code>GenFace</code>](#GenFace)  
<a name="GenFace.PING_VERSION"></a>

### GenFace.PING_VERSION
Latest supported FTN4 version

**Kind**: static property of [<code>GenFace</code>](#GenFace)  
<a name="GenFace.register"></a>

### GenFace.register(as, ccm, name, endpoint, [credentials], [options])
CCM registration helper

**Kind**: static method of [<code>GenFace</code>](#GenFace)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | steps interface |
| ccm | <code>AdvancedCCM</code> |  | CCM instance |
| name | <code>string</code> |  | CCM registration name |
| endpoint | <code>\*</code> |  | see AdvancedCCM#register |
| [credentials] | <code>\*</code> | <code></code> | see AdvancedCCM#register |
| [options] | <code>object</code> | <code>{}</code> | interface options |
| [options.version] | <code>string</code> | <code>&quot;1.0&quot;</code> | interface version to use |

<a name="GenService"></a>

## GenService
Event Stream - Generator Service Base

**Kind**: global class  
<a name="GenService.register"></a>

### GenService.register(as, executor, options) ⇒ [<code>GenService</code>](#GenService)
Register futoin.evt.gen interface with Executor

**Kind**: static method of [<code>GenService</code>](#GenService)  
**Returns**: [<code>GenService</code>](#GenService) - instance  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | steps interface |
| executor | <code>Executor</code> | executor instance |
| options | <code>object</code> | implementation defined options |

<a name="LiveReceiver"></a>

## LiveReceiver
Reliable Event Receiver helper to minimize boilerplate code in projects.

**Kind**: global class  

* [LiveReceiver](#LiveReceiver)
    * [new LiveReceiver(executor_ccm)](#new_LiveReceiver_new)
    * [.start(endpoint, [credentials], [options])](#LiveReceiver+start)
    * [.stop()](#LiveReceiver+stop)
    * [._registerReceiver(as, executor, options)](#LiveReceiver+_registerReceiver) ⇒ [<code>ReceiverService</code>](#ReceiverService)
    * [._onEvents(as, events)](#LiveReceiver+_onEvents)
    * ["receiverError"](#LiveReceiver+event_receiverError)
    * ["workerError"](#LiveReceiver+event_workerError)
    * ["newEvents"](#LiveReceiver+event_newEvents)
    * ["ready"](#LiveReceiver+event_ready)

<a name="new_LiveReceiver_new"></a>

### new LiveReceiver(executor_ccm)
Initialize event archiver.


| Param | Type | Description |
| --- | --- | --- |
| executor_ccm | <code>AdvancedCCM</code> | CCM for executor |

<a name="LiveReceiver+start"></a>

### liveReceiver.start(endpoint, [credentials], [options])
Start receiving events for archiving

**Kind**: instance method of [<code>LiveReceiver</code>](#LiveReceiver)  
**Note**: options.executor is overridden  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| endpoint | <code>\*</code> |  | see PushFace |
| [credentials] | <code>\*</code> | <code></code> | see PushFace |
| [options] | <code>\*</code> | <code>{}</code> | see PushFace |
| [options.component] | <code>string</code> |  | component name |
| [options.want] | <code>array</code> |  | "want" parameter for event filtering |

<a name="LiveReceiver+stop"></a>

### liveReceiver.stop()
Stop receiving events

**Kind**: instance method of [<code>LiveReceiver</code>](#LiveReceiver)  
<a name="LiveReceiver+_registerReceiver"></a>

### liveReceiver._registerReceiver(as, executor, options) ⇒ [<code>ReceiverService</code>](#ReceiverService)
Override to register custom instance of ReceiverService.

**Kind**: instance method of [<code>LiveReceiver</code>](#LiveReceiver)  
**Returns**: [<code>ReceiverService</code>](#ReceiverService) - instance of service  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | async steps interface |
| executor | <code>Executor</code> | Internal Executor instance |
| options | <code>object</code> | passed options |

<a name="LiveReceiver+_onEvents"></a>

### liveReceiver._onEvents(as, events)
Override to catch new events here instead of using `newEvents` event handler.

**Kind**: instance method of [<code>LiveReceiver</code>](#LiveReceiver)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | async steps interface |
| events | <code>array</code> | array of events |

<a name="LiveReceiver+event_receiverError"></a>

### "receiverError"
Emitted on not expected receiver errors

**Kind**: event emitted by [<code>LiveReceiver</code>](#LiveReceiver)  
<a name="LiveReceiver+event_workerError"></a>

### "workerError"
Emitted on worker errors

**Kind**: event emitted by [<code>LiveReceiver</code>](#LiveReceiver)  
<a name="LiveReceiver+event_newEvents"></a>

### "newEvents"
Emitted on new events

**Kind**: event emitted by [<code>LiveReceiver</code>](#LiveReceiver)  
<a name="LiveReceiver+event_ready"></a>

### "ready"
Emitted after event receiver is ready

**Kind**: event emitted by [<code>LiveReceiver</code>](#LiveReceiver)  
<a name="PollFace"></a>

## PollFace
Event Stream - Poll Face

**Kind**: global class  

* [PollFace](#PollFace)
    * [.LATEST_VERSION](#PollFace.LATEST_VERSION)
    * [.PING_VERSION](#PollFace.PING_VERSION)
    * [.register(as, ccm, name, endpoint, [credentials], [options])](#PollFace.register)

<a name="PollFace.LATEST_VERSION"></a>

### PollFace.LATEST_VERSION
Latest supported FTN17 version

**Kind**: static property of [<code>PollFace</code>](#PollFace)  
<a name="PollFace.PING_VERSION"></a>

### PollFace.PING_VERSION
Latest supported FTN4 version

**Kind**: static property of [<code>PollFace</code>](#PollFace)  
<a name="PollFace.register"></a>

### PollFace.register(as, ccm, name, endpoint, [credentials], [options])
CCM registration helper

**Kind**: static method of [<code>PollFace</code>](#PollFace)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | steps interface |
| ccm | <code>AdvancedCCM</code> |  | CCM instance |
| name | <code>string</code> |  | CCM registration name |
| endpoint | <code>\*</code> |  | see AdvancedCCM#register |
| [credentials] | <code>\*</code> | <code></code> | see AdvancedCCM#register |
| [options] | <code>object</code> | <code>{}</code> | interface options |
| [options.version] | <code>string</code> | <code>&quot;1.0&quot;</code> | interface version to use |

<a name="PollService"></a>

## PollService
Event Stream - Poll Service Base

**Kind**: global class  
<a name="PollService.register"></a>

### PollService.register(as, executor, options) ⇒ [<code>PollService</code>](#PollService)
Register futoin.evt.poll interface with Executor

**Kind**: static method of [<code>PollService</code>](#PollService)  
**Returns**: [<code>PollService</code>](#PollService) - instance  
**Note**: Chunk event count is lower then protocol permits by default as there is
      a typical amount 64K futoin message limit.  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | steps interface |
| executor | <code>Executor</code> |  | executor instance |
| options | <code>object</code> |  | implementation defined options |
| [options.allow_reliable] | <code>boolean</code> | <code>true</code> | allow reliable consumers |
| [options.allow_polling] | <code>boolean</code> | <code>true</code> | allow polling calls |
| [options.max_chunk_events] | <code>integer</code> | <code>100</code> | maxium events per request |

<a name="PushFace"></a>

## PushFace
Event Stream - Push Face

**Kind**: global class  
<a name="PushFace.register"></a>

### PushFace.register(as, ccm, name, endpoint, [credentials], [options])
CCM registration helper

**Kind**: static method of [<code>PushFace</code>](#PushFace)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | steps interface |
| ccm | <code>AdvancedCCM</code> |  | CCM instance |
| name | <code>string</code> |  | CCM registration name |
| endpoint | <code>\*</code> |  | see AdvancedCCM#register |
| [credentials] | <code>\*</code> | <code></code> | see AdvancedCCM#register |
| [options] | <code>object</code> | <code>{}</code> | interface options |
| [options.version] | <code>string</code> | <code>&quot;1.0&quot;</code> | interface version to use |

<a name="PushService"></a>

## PushService
Event Stream - Push Service Base

**Kind**: global class  

* [PushService](#PushService)
    * _instance_
        * ["pushError"](#PushService+event_pushError)
        * ["queueOverflow"](#PushService+event_queueOverflow)
    * _static_
        * [.register(as, executor, options)](#PushService.register) ⇒ [<code>PushService</code>](#PushService)

<a name="PushService+event_pushError"></a>

### "pushError"
Emitted in push error handlers

**Kind**: event emitted by [<code>PushService</code>](#PushService)  
<a name="PushService+event_queueOverflow"></a>

### "queueOverflow"
Emitted in push error handlers

**Kind**: event emitted by [<code>PushService</code>](#PushService)  
<a name="PushService.register"></a>

### PushService.register(as, executor, options) ⇒ [<code>PushService</code>](#PushService)
Register futoin.evt.push interface with Executor

**Kind**: static method of [<code>PushService</code>](#PushService)  
**Returns**: [<code>PushService</code>](#PushService) - instance  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | steps interface |
| executor | <code>Executor</code> |  | executor instance |
| options | <code>object</code> |  | implementation defined options |
| [options.allow_reliable] | <code>boolean</code> | <code>true</code> | allow reliable consumers |
| [options.allow_polling] | <code>boolean</code> | <code>true</code> | allow polling calls |

<a name="ReceiverFace"></a>

## ReceiverFace
Event Stream - Receiver Face

**Kind**: global class  

* [ReceiverFace](#ReceiverFace)
    * [.LATEST_VERSION](#ReceiverFace.LATEST_VERSION)
    * [.register(as, channel, [options])](#ReceiverFace.register) ⇒ <code>string</code>

<a name="ReceiverFace.LATEST_VERSION"></a>

### ReceiverFace.LATEST_VERSION
Latest supported FTN17 version

**Kind**: static property of [<code>ReceiverFace</code>](#ReceiverFace)  
<a name="ReceiverFace.register"></a>

### ReceiverFace.register(as, channel, [options]) ⇒ <code>string</code>
CCM registration helper

**Kind**: static method of [<code>ReceiverFace</code>](#ReceiverFace)  
**Returns**: <code>string</code> - - iface:ver of registered interface  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| as | <code>AsyncSteps</code> |  | steps interface |
| channel | <code>ChannelContext</code> |  | Bi-Direction channel instance |
| [options] | <code>object</code> | <code>{}</code> | interface options |
| [options.version] | <code>string</code> | <code>&quot;1.0&quot;</code> | interface version to use |

<a name="ReceiverService"></a>

## ReceiverService
Base implementation for receiver side

**Kind**: global class  

* [ReceiverService](#ReceiverService)
    * _instance_
        * [._onEvents(as, reqinfo, events)](#ReceiverService+_onEvents)
    * _static_
        * [.register(as, executor, options)](#ReceiverService.register) ⇒ [<code>PushService</code>](#PushService)

<a name="ReceiverService+_onEvents"></a>

### receiverService._onEvents(as, reqinfo, events)
Member to override to handle vents.

**Kind**: instance method of [<code>ReceiverService</code>](#ReceiverService)  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | AsyncSteps interface |
| reqinfo | <code>RequestInfo</code> | request info object |
| events | <code>array</code> | list of events |

<a name="ReceiverService.register"></a>

### ReceiverService.register(as, executor, options) ⇒ [<code>PushService</code>](#PushService)
Register futoin.evt.receiver interface with Executor

**Kind**: static method of [<code>ReceiverService</code>](#ReceiverService)  
**Returns**: [<code>PushService</code>](#PushService) - instance  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | steps interface |
| executor | <code>Executor</code> | executor instance |
| options | <code>object</code> | implementation defined options |

<a name="ReliableReceiver"></a>

## ReliableReceiver
Reliable Event Receiver helper to minimize boilerplate code in projects.

**Kind**: global class  

* [ReliableReceiver](#ReliableReceiver)
    * [._registerReceiver(as, executor, options)](#ReliableReceiver+_registerReceiver) ⇒ [<code>ReliableReceiverService</code>](#ReliableReceiverService)
    * ["processedEvents"](#ReliableReceiver+event_processedEvents)

<a name="ReliableReceiver+_registerReceiver"></a>

### reliableReceiver._registerReceiver(as, executor, options) ⇒ [<code>ReliableReceiverService</code>](#ReliableReceiverService)
Override to register custom instance of ReliableReceiverService.

**Kind**: instance method of [<code>ReliableReceiver</code>](#ReliableReceiver)  
**Returns**: [<code>ReliableReceiverService</code>](#ReliableReceiverService) - instance of service  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | async steps interface |
| executor | <code>Executor</code> | Internal Executor instance |
| options | <code>object</code> | passed options |

<a name="ReliableReceiver+event_processedEvents"></a>

### "processedEvents"
Emitted for count of archived events in each iteration.

**Kind**: event emitted by [<code>ReliableReceiver</code>](#ReliableReceiver)  
<a name="ReliableReceiverService"></a>

## ReliableReceiverService
Base implementation for reliable receiver side.

**Kind**: global class  
**Note**: Unlike ReceiverService, it restores proper order of events.  


*documented by [jsdoc-to-markdown](https://github.com/75lb/jsdoc-to-markdown)*.


