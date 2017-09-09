
  [![NPM Version](https://img.shields.io/npm/v/futoin-eventstream.svg?style=flat)](https://www.npmjs.com/package/futoin-eventstream)
  [![NPM Downloads](https://img.shields.io/npm/dm/futoin-eventstream.svg?style=flat)](https://www.npmjs.com/package/futoin-eventstream)
  [![Build Status](https://travis-ci.org/futoin/core-js-ri-database.svg?branch=master)](https://travis-ci.org/futoin/core-js-ri-database)
  [![stable](https://img.shields.io/badge/stability-stable-green.svg?style=flat)](https://www.npmjs.com/package/futoin-asyncsteps)

  [![NPM](https://nodei.co/npm/futoin-eventstream.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/futoin-eventstream/)

# FutoIn reference implementation

Reference implementation of:
 
    FTN17: FutoIn Interface - Event Stream
    Version: 1.0
    
* Spec: [FTN17: FutoIn Interface - Event Stream v1.x](http://specs.futoin.org/draft/preview/ftn18_if_eventstream-1.html)

[Web Site](http://futoin.org/)

# About

Work in progress. This readme to be updated when ready for production.


# Installation for Node.js

Command line:
```sh
$ npm install futoin-eventstream --save
```

# Concept


# Examples

## 1. 

```javascript
```

    
# API documentation

The concept is described in FutoIn specification: [FTN18: FutoIn Interface - Event Stream v1.x](http://specs.futoin.org/draft/preview/ftn18_if_eventstream-1.html)

## Classes

<dl>
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
</dl>

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
| [table] | <code>string</code> | <code>&quot;EvtQueue&quot;</code> | event queue |

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



*documented by [jsdoc-to-markdown](https://github.com/75lb/jsdoc-to-markdown)*.


