'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.post = post;
exports.query = query;
exports.get = get;
exports.patch = patch;
exports.del = del;

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _json = require('../util/json');

var _json2 = _interopRequireDefault(_json);

var _protect = require('../util/protect');

var _Client = require('../models/Client');

var _Client2 = _interopRequireDefault(_Client);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function post(ctx) {
	var data;
	return regeneratorRuntime.async(function post$(_context) {
		while (1) switch (_context.prev = _context.next) {
			case 0:
				_context.next = 2;
				return regeneratorRuntime.awrap((0, _protect.protect)(ctx, 'AuthX:client:create'));

			case 2:
				_context.next = 4;
				return regeneratorRuntime.awrap((0, _json2.default)(ctx.req));

			case 4:
				data = _context.sent;
				_context.next = 7;
				return regeneratorRuntime.awrap(_Client2.default.create(ctx.conn, data));

			case 7:
				ctx.body = _context.sent;

				ctx.status = 201;

			case 9:
			case 'end':
				return _context.stop();
		}
	}, null, this);
}

function query(ctx) {
	var clients;
	return regeneratorRuntime.async(function query$(_context2) {
		while (1) switch (_context2.prev = _context2.next) {
			case 0:
				_context2.next = 2;
				return regeneratorRuntime.awrap((0, _protect.protect)(ctx, 'AuthX:authority.*:read', false));

			case 2:
				_context2.next = 4;
				return regeneratorRuntime.awrap(_Client2.default.query(ctx.conn));

			case 4:
				clients = _context2.sent;
				_context2.next = 7;
				return regeneratorRuntime.awrap(_bluebird2.default.filter(clients, function (c) {
					return (0, _protect.can)(ctx, 'AuthX:client.' + c.id + ':read');
				}));

			case 7:
				ctx.body = _context2.sent;

			case 8:
			case 'end':
				return _context2.stop();
		}
	}, null, this);
}

function get(ctx) {
	return regeneratorRuntime.async(function get$(_context3) {
		while (1) switch (_context3.prev = _context3.next) {
			case 0:
				_context3.next = 2;
				return regeneratorRuntime.awrap((0, _protect.protect)(ctx, 'AuthX:client.' + ctx.params.client_id + ':read'));

			case 2:
				_context3.next = 4;
				return regeneratorRuntime.awrap(_Client2.default.get(ctx.conn, ctx.params.client_id));

			case 4:
				ctx.body = _context3.sent;

			case 5:
			case 'end':
				return _context3.stop();
		}
	}, null, this);
}

function patch(ctx) {
	var data;
	return regeneratorRuntime.async(function patch$(_context4) {
		while (1) switch (_context4.prev = _context4.next) {
			case 0:
				_context4.next = 2;
				return regeneratorRuntime.awrap((0, _protect.protect)(ctx, 'AuthX:client.' + ctx.params.client_id + ':update'));

			case 2:
				_context4.next = 4;
				return regeneratorRuntime.awrap((0, _json2.default)(ctx.req));

			case 4:
				data = _context4.sent;

				if (!(typeof data.scopes !== 'undefined')) {
					_context4.next = 8;
					break;
				}

				_context4.next = 8;
				return regeneratorRuntime.awrap((0, _protect.protect)(ctx, 'AuthX:client.' + ctx.params.client_id + ':update.scopes'));

			case 8:
				_context4.next = 10;
				return regeneratorRuntime.awrap(_Client2.default.update(ctx.conn, ctx.params.client_id, data));

			case 10:
				ctx.body = _context4.sent;

			case 11:
			case 'end':
				return _context4.stop();
		}
	}, null, this);
}

function del(ctx) {
	return regeneratorRuntime.async(function del$(_context5) {
		while (1) switch (_context5.prev = _context5.next) {
			case 0:
				_context5.next = 2;
				return regeneratorRuntime.awrap((0, _protect.protect)(ctx, 'AuthX:client.' + ctx.params.client_id + ':delete'));

			case 2:
				_context5.next = 4;
				return regeneratorRuntime.awrap(_Client2.default.delete(ctx.conn, ctx.params.client_id));

			case 4:
				ctx.body = _context5.sent;

			case 5:
			case 'end':
				return _context5.stop();
		}
	}, null, this);
}