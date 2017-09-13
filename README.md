
  [![NPM Version](https://img.shields.io/npm/v/futoin-eventstream.svg?style=flat)](https://www.npmjs.com/package/futoin-eventstream)
  [![NPM Downloads](https://img.shields.io/npm/dm/futoin-eventstream.svg?style=flat)](https://www.npmjs.com/package/futoin-eventstream)
  [![Build Status](https://travis-ci.org/futoin/core-js-ri-eventstream.svg?branch=master)](https://travis-ci.org/futoin/core-js-ri-eventstream)
  [![stable](https://img.shields.io/badge/stability-stable-green.svg?style=flat)](https://www.npmjs.com/package/futoin-eventstream)

  [![NPM](https://nodei.co/npm/futoin-eventstream.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/futoin-eventstream/)

# FutoIn reference implementation

Reference implementation of:
 
    FTN17: FutoIn Interface - Event Stream
    Version: 1.0
    
* Spec: [FTN18: FutoIn Interface - Event Stream v1.x](http://specs.futoin.org/final/preview/ftn18_if_eventstream-1.html)

[Web Site](http://futoin.org/)

# About

Unlike various message/event brokers, the focus of FutoIn Event Stream is integration
with database transactions for reliable efficient event recording and delivery.

The design is not focused on high throughput as the primary reason is reliable association of events
with database changes. Please consider using pure message brokers for throughput-intensive cases.

It may not be immediately obvious how to use this FutoIn sub-project, but it's a fundamental part
for asynchronous state distribution and interaction in large microservice systems.

**You should really understand the concepts to properly use it.**

# Stability Warning

The code is fully covered in tests, including many edge cases. However, the software is still
considered to be in Beta stage.

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

There are two configurable delivery strategies are supported: polling and streaming, but consumer
acts as client in both cases.

There are two delivery modes: reliable and live. The later allow messages to be skipped.
To ensure that events are reliably delivered, each consumer must register first.

There are two message storage types assumed: active small high performance area and slower data warehouse
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

For more advanced cases, you can check source code of GenFace#addXferEvent()
to build more tailored statemented.

```javascript
GenFace.register(as, ccm, 'evtgen', endpoint );
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

The should be a single system-wide instance of DBEventArchiver tool.
The tool will automatically reconnect on errors. Processing state
can be monitored through events.

```javascript
DBAutoConfig(as, {
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


    
# API documentation

The concept is described in FutoIn specification: [FTN18: FutoIn Interface - Event Stream v1.x](http://specs.futoin.org/final/preview/ftn18_if_eventstream-1.html)

## Classes

<dl>
<dt><a href="#DBEventArchiver">DBEventArchiver</a></dt>
<dd><p>Database Event Archiver service.</p>
</dd>
<dt><a href="#EventArchiver">EventArchiver</a></dt>
<dd></dd>
<dt><a href="#GenFace">GenFace</a></dt>
<dd><p>Event Stream - Generator Face</p>
</dd>
<dt><a href="#GenService">GenService</a></dt>
<dd><p>Event Stream - Generator Service Base</p>
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
<dt><a href="#ReliableReceiverService">ReliableReceiverService</a></dt>
<dd><p>Base implementation for reliable receiver side</p>
</dd>
</dl>

<a name="DBEventArchiver"></a>

## DBEventArchiver
Database Event Archiver service.

**Kind**: global class  
**Note**: No more than one instance should run at once.  
<a name="EventArchiver"></a>

## EventArchiver
**Kind**: global class  

* [EventArchiver](#EventArchiver)
    * [new EventArchiver(executor_ccm)](#new_EventArchiver_new)
    * [.start(endpoint, [credentials], [options])](#EventArchiver+start)
    * [.stop()](#EventArchiver+stop)
    * ["receiverError"](#EventArchiver+event_receiverError)
    * ["workerError"](#EventArchiver+event_workerError)
    * ["newEvents"](#EventArchiver+event_newEvents)

<a name="new_EventArchiver_new"></a>

### new EventArchiver(executor_ccm)
Initialize event archiver.


| Param | Type | Description |
| --- | --- | --- |
| executor_ccm | <code>AdvancedCCM</code> | CCM for executor |

<a name="EventArchiver+start"></a>

### eventArchiver.start(endpoint, [credentials], [options])
Start receiving events for archiving

**Kind**: instance method of [<code>EventArchiver</code>](#EventArchiver)  
**Note**: options.executor is overridden  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| endpoint | <code>\*</code> |  | see PushFace |
| [credentials] | <code>\*</code> | <code></code> | see PushFace |
| [options] | <code>\*</code> | <code>{}</code> | see PushFace |

<a name="EventArchiver+stop"></a>

### eventArchiver.stop()
Stop receiving events

**Kind**: instance method of [<code>EventArchiver</code>](#EventArchiver)  
<a name="EventArchiver+event_receiverError"></a>

### "receiverError"
Emitted on not expected receiver errors

**Kind**: event emitted by [<code>EventArchiver</code>](#EventArchiver)  
<a name="EventArchiver+event_workerError"></a>

### "workerError"
Emitted on worker errors

**Kind**: event emitted by [<code>EventArchiver</code>](#EventArchiver)  
<a name="EventArchiver+event_newEvents"></a>

### "newEvents"
Emitted after new events being pushed to DWH

**Kind**: event emitted by [<code>EventArchiver</code>](#EventArchiver)  
<a name="GenFace"></a>

## GenFace
Event Stream - Generator Face

**Kind**: global class  

* [GenFace](#GenFace)
    * _instance_
        * [.addXferEvent(xb, type, data, [table])](#GenFace+addXferEvent)
    * _static_
        * [.LATEST_VERSION](#GenFace.LATEST_VERSION)
        * [.PING_VERSION](#GenFace.PING_VERSION)
        * [.register(as, ccm, name, endpoint, [credentials], [options])](#GenFace.register)

<a name="GenFace+addXferEvent"></a>

### genFace.addXferEvent(xb, type, data, [table])
Helper to add event generation into DB transaction

**Kind**: instance method of [<code>GenFace</code>](#GenFace)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| xb | <code>XferBuilder</code> |  | instance of transaction builder |
| type | <code>string</code> |  | event type |
| data | <code>\*</code> |  | any data |
| [table] | <code>string</code> | <code>&quot;evt_queue&quot;</code> | event queue |

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

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | steps interface |
| executor | <code>Executor</code> | executor instance |
| options | <code>object</code> | implementation defined options |

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

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | steps interface |
| executor | <code>Executor</code> | executor instance |
| options | <code>object</code> | implementation defined options |

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

<a name="ReliableReceiverService"></a>

## ReliableReceiverService
Base implementation for reliable receiver side

**Kind**: global class  

* [ReliableReceiverService](#ReliableReceiverService)
    * _instance_
        * ["newEvents"](#ReliableReceiverService+event_newEvents)
    * _static_
        * [.register(as, executor, options)](#ReliableReceiverService.register) ⇒ [<code>PushService</code>](#PushService)

<a name="ReliableReceiverService+event_newEvents"></a>

### "newEvents"
Emitted after new events being pushed to DWH

**Kind**: event emitted by [<code>ReliableReceiverService</code>](#ReliableReceiverService)  
<a name="ReliableReceiverService.register"></a>

### ReliableReceiverService.register(as, executor, options) ⇒ [<code>PushService</code>](#PushService)
Register futoin.evt.receiver interface with Executor

**Kind**: static method of [<code>ReliableReceiverService</code>](#ReliableReceiverService)  
**Returns**: [<code>PushService</code>](#PushService) - instance  

| Param | Type | Description |
| --- | --- | --- |
| as | <code>AsyncSteps</code> | steps interface |
| executor | <code>Executor</code> | executor instance |
| options | <code>object</code> | implementation defined options |



*documented by [jsdoc-to-markdown](https://github.com/75lb/jsdoc-to-markdown)*.


