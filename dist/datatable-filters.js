(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);

/**
 * BaseFilter
 */
var BaseFilter = {

    /**
     * @returns {Boolean} Whether a filter change must trigger a datatable reload.
     * Default is false (client side filter).
     */
    isServerSide: function () {
        return false;
    },

    /**
     * @returns {String} The request parameter associated with this filter (in the form key=param,
     * only used for server side filters)
     */
    getServerQuery: function () {
        return '';
    },

    notifyChange: function () {
        this.$dom.trigger('update.filters.dt', {
            filter: this
        });

        return this;
    },

    /**
     * @returns {String} The filter string to be applied to the datatable column
     */
    getQuery: function () {
        if (!this.hasValue())
            return this.noSelectionQuery();

        return this.selectedQuery();
    },

    register: function(callback) {
        this.$dom.on('update.filters.dt', callback);
    }
};

module.exports = BaseFilter;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],2:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);

/**
 * Filters is a component that manages a list of filters object inside
 * a datatable header row.
 *
 * This constructor binds listeners to various datatable events.
 *
 * @param settings {Object} settings object used to create the datatable
 */
var Filters = function (settings) {
    this.tableAPI = new $.fn.dataTable.Api(settings);
    this.$header = $(this.tableAPI.table().header());
    this.url = this.tableAPI.ajax.url();

    var filters = [];
    var builders = this.builders;
    var renderCol = 0;
    $.each(settings.aoColumns, function (col, param) {
        if (param.filter) {
            var options = $.extend({
              column: col,
              renderColumn: renderCol
            }, param.filter);
            filters.push(builders[param.filter.type](options));
        }
        if(param.bVisible) {
          renderCol++;
        }
    });

    if (filters.length > 0) {
        this.filters = filters;
        this.filters.forEach(function (filter) {
            filter.init();
        });
        this.filters.forEach(this.applyInitialFilter, this);
        this.tableAPI.on('init', this.onDataTableInit.bind(this));
    }
};

$.extend(Filters.prototype, {

    /**
     * Array of filter constructor function. Each function
     * takes a setting object as its single parameter
     */
    builders: {},

    /**
     * Table header dom node
     * @type {jQuery}
     */
    $header: null,

    /**
     * Filters array
     * @type {Array}
     */
    filters: [],

    /**
     * Table initial ajax URL
     * @type {String}
     */
    url: '',

    /**
     * Refreshes filters after each ajax request
     *
     * @returns {Filters}
     */
    registerAjaxListener: function () {
        this.tableAPI.on('xhr', $.proxy(function () {
            this.tableAPI.one('preDraw', $.proxy(this.refreshFilters, this));
        }, this));

        return this;
    },

    /**
     * Initializes the header HTML elements that will be used to hold the filters.
     * It also registers the main event handler that will react to the filters'
     * value changes.
     *
     * The event name is <b>filterChange</b>. This event must be triggered by the
     * filters when their value is modified by the user (or any other event that
     * should trigger a datatable filter).
     *
     * @returns {Filters}
     */
    setupHeaderRow: function () {
        var $filterHeader = $('<tr class="filters"></tr>');

        this.tableAPI.columns(':visible').header().each(function () {
            $filterHeader.append('<th class="fond-header"></th>');
        });

        this.$header.append($filterHeader);

        return this;
    },

    /**
     * Redraws the datatable
     *
     * @returns {Filters}
     */
    drawTable: function () {
        this.tableAPI.draw();

        return this;
    },

    /**
     * Retrieves the column data (current filter is ignored)
     *
     * @param col {int} The column index (0 based)
     *
     * @return {jQuery} The unfiltered column rendered data
     */
    getColumnData: function (col) {
        return this.tableAPI.cells(null, col).render('display').unique();
    },

    /**
     * Retrieves the column filtered data
     *
     * @param col {int} The column index (0 based)
     *
     * @return {jQuery} The filtered column data
     */
    getFilteredColumnData: function (col) {
        return this.tableAPI.column(col, {search: 'applied'}).data().unique();
    },

    /**
     * Actions to execute when the datatable is done initializing.
     * Creates the filter header row, registers ajax listeners and
     * renders filters
     *
     * @returns {Filters}
     */
    onDataTableInit: function () {
        this.setupHeaderRow().registerAjaxListener().renderFilters();

        return this;
    },

    /**
     * When a client-side filter changes, applies its new value
     *
     * @param event {Event} event object
     * @param params {Object} event params
     *
     * @return {Filters}
     */
    onClientFilterChange: function (event, params) {
        this.applyFilter(params.filter).drawTable();

        return this;
    },

    /**
     * When a server-side filter changes, builds the new ajax query and refreshes the table
     *
     * @return {Filters}
     */
    onServerFilterChange: function () {
        var serverQuery = $.grep(this.filters, function (filter) {
            return filter.isServerSide();
        }).map(function (filter) {
            return filter.getServerQuery();
        }).join('&');

        this.tableAPI.ajax.url(this.url + '?' + serverQuery).ajax.reload();

        return this;
    },

    /**
     * Applies the filter value to the related column
     *
     * @param filter The filter object
     *
     * @return {Filters}
     */
    applyFilter: function (filter) {
        this.tableAPI.column(filter.column).search(
            filter.getQuery(),
            filter.isRegexMatch()
            , false);

        return this;
    },

    /**
     * Enables filters to apply an initial column filter, before
     * any data processing/displaying is done.
     *
     * @param filter
     * @returns {Filters}
     */
    applyInitialFilter: function (filter) {
        this.tableAPI.column(filter.column).search(
            filter.getInitialQuery(),
            filter.isRegexMatch()
            , false);

        return this;
    },

    /**
     * @see this.renderFilter
     *
     * @returns {Filters}
     */
    renderFilters: function () {
        this.filters.forEach(this.renderFilter, this);

        return this;
    },

    /**
     * Asks a filter to render itself and provides an optional container
     * for filters that need to be rendered inside the datatable header row
     *
     * @param filter The filter object
     */
    renderFilter: function (filter) {
        var col = filter.column;
        var $colHeader = $(this.tableAPI.column(col).header());
        var $container = this.$header.find('.fond-header:eq(' + filter.renderColumn + ')');

        if (filter.isServerSide()) {
            filter.register($.proxy(this.onServerFilterChange, this));
        } else {
            filter.register($.proxy(this.onClientFilterChange, this));
        }

        filter.render($container, $colHeader.html(), this.getColumnData(col));
        if(filter.className) {
          filter.$dom.addClass(filter.className);
        }
        if(filter.attrs) {
          filter.$dom.attr(filter.attrs);
        }
    },

    /**
     * Refreshes the filters based on the currently displayed data for each column
     *
     * @return {Filters}
     */
    refreshFilters: function () {
        this.filters.forEach(function (filter) {
            filter.refresh(this.getColumnData(filter.column));
            this.applyFilter(filter);
        }, this);

        this.drawTable();

        return this;
    }
});

$(document).on('preInit.dt', function (e, settings) {
    new Filters(settings);
});

module.exports = Filters;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],3:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);
var BaseFilter = require('../basefilter');
var SimpleRenderer = require('../renderer/simple');
var Filters = require('../filters');

var InputFilter = $.extend({}, BaseFilter, SimpleRenderer, {

    init: function () {
        this.$dom = $('<input class="filtre"/>');
        this.$dom.on('input', this.notifyChange.bind(this));

        return this;
    },

    populate: function () {
        return this;
    },

    update: function () {
        return this;
    },

    noSelectionQuery: function () {
        return '';
    },

    isRegexMatch: function () {
        return true;
    },

    hasValue: function () {
        return this.$dom.val() != '';
    },

    selectedQuery: function () {
        return this.$dom.val();
    },

    getInitialQuery: function () {
        return '';
    }
});

Filters.prototype.builders.input = function(settings) {
  return $.extend({}, InputFilter, settings);
};

module.exports = InputFilter;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../basefilter":1,"../filters":2,"../renderer/simple":5}],4:[function(require,module,exports){
'use strict';

require('./select/simpleselect');
require('./select/multiselect');
require('./select/fixedselect');
require('./input/input');
require('./filters');
},{"./filters":2,"./input/input":3,"./select/fixedselect":7,"./select/multiselect":8,"./select/simpleselect":11}],5:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);

var SimpleRenderer = {
    render: function ($container, header, data) {
        this.populate(data);
        this.showFilter(this.$dom, $container, header, data);

        return this;
    },

    showFilter: function($dom, $container, header, data) {
        $container.append(this.$dom);
        this.$dom.attr('name', header).attr('placeholder', header).show();
    },

    refresh: function (data) {
        this.update(data);

        return this;
    }
};

module.exports = SimpleRenderer;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],6:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);
var BaseFilter = require('../basefilter');
var SimpleRenderer = require('../renderer/simple');
var BootstrapRenderer = require('./renderer/bootstrap');
var ChosenRender = require('./renderer/chosen');

/**
 * SelectFilter regroups common behavior for select filters
 */
var SelectFilter = $.extend({}, BaseFilter, {
    selected: [],

    /**
     * @returns {string} Returns an always false regex to hide every records
     * when no option is selected
     */
    noSelectionQuery: function () {
        return '$.^';
    },

    /**
     * @returns {boolean} True. Select filters always use regex
     */
    isRegexMatch: function () {
        return true;
    },

    /**
     * @returns {boolean} Returns true if at least one option is selected
     */
    hasValue: function () {
        return this._getSelection().length > 0;
    },

    /**
     * @returns {String} The column filter query to apply. Selected option values
     * are concatenated into a string using the pipe character (regex or)
     */
    selectedQuery: function () {
        return this._getSelection().map(function (value) {
            if (value == this.allText  || this._getNotSelected().length === 0) {
                return '';
            } else {
                return '^' + $.fn.dataTable.util.escapeRegex(value) + '$';
            }
        }, this).join('|');
    },

    /**
     * Filters the options before adding them to the select. Can be overridden
     * for specific filtering
     *
     * @param value {String} Option value
     */
    filterOptions: function (value) {
        return value.trim() != '';
    },

    /**
     * Sort the options before adding them to the select. Can be overridden for
     * specific sorts
     */
    sortOptions: function (a, b) {
        if (a > b) {
            return 1;
        }

        if (a < b) {
            return -1;
        }

        return 0;
    },

    /**
     * @returns {Array<String>} The array of selected values
     * @private
     */
    _getSelection: function () {
        return this.$dom.find('option:selected').toArray().map(function(option) {
            return option.value;
        });
    },

    /**
     *
     * @returns {*|Array} The array of non selected values
     * @private
     */
    _getNotSelected: function() {
        return this.$dom.find(':not(option:selected)').toArray().map(function(option) {
            return option.value;
        });
    },

    /**
     * For each element in the data object, creates an option element using the function
     * fnCreate
     *
     * @param data {jQuery} The data to add to the select
     * @param fnCreate {Function} The function to use to create the options
     * @private
     */
    _addOptions: function (data, fnCreate) {
        this.$dom.empty();

        if (this.allText)
            fnCreate.call(this, this.allText);

        data.toArray().filter(this.filterOptions).sort(this.sortOptions).forEach(fnCreate, this);
    },

    /**
     * Creates a selected option
     *
     * @param value {String} The option value
     * @private
     */
    _addSelectedOption: function (value) {
        this.$dom.append($('<option/>')
            .val(value)
            .text(value)
            .attr('selected', 'selected')
        );
    },

    /**
     * Creates an option with the selected flag based on the
     * current filter state
     *
     * @param value {String} The option value
     * @private
     */
    _refreshOption: function (value) {
        var $option = $('<option/>')
            .val(value)
            .text(value);

        if ($.inArray(value, this.selected) > -1)
            $option.attr('selected', 'selected');

        this.$dom.append($option);
    },

    /**
     * Takes a snapshot of the current selection state
     *
     * @private
     */
    _saveSelection: function() {
        this.selected = this._getSelection();
    },

    /**
     * Whenever the select state changes, save its new state and
     * notify the listening component
     *
     * @private
     */
    _onChange: function() {
        this._saveSelection();
        this.notifyChange();
    }
});

 var availableRenderers = {
    'bootstrap': BootstrapRenderer,
    'chosen': ChosenRender
};

var builder = function(settings) {
    var renderer = availableRenderers[settings.renderer] || SimpleRenderer;

    return $.extend({}, this, renderer, settings);
};

module.exports = {
    SelectFilter: SelectFilter,
    builder: builder
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../basefilter":1,"../renderer/simple":5,"./renderer/bootstrap":9,"./renderer/chosen":10}],7:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);
var Filters = require('../filters');
var BaseSelect = require('./baseselect');

var FixedSelectFilter = $.extend({}, BaseSelect.SelectFilter, {

    /**
     * Simply saves a handle on the provided source select
     *
     * @returns {FixedSelectFilter}
     */
    init: function () {
        this.$dom = $(this.src);
        this.$dom.on('change', this.notifyChange.bind(this));

        return this;
    },

    /**
     * No action for fixed filters: the provided select is used as is
     *
     * @returns {FixedSelectFilter}
     */
    populate: function () {
        return this;
    },

    /**
     * No update for fixed filters: the provided select is never changed
     *
     * @returns {FixedSelectFilter}
     */
    update: function () {
        return this;
    },

    /**
     * Fixed filters can be used to provide initial filters to apply to the
     * datatable.
     *
     * @returns {*|String}
     */
    getInitialQuery: function() {
        return this.getQuery();
    }
});

Filters.prototype.builders.fixedselect = BaseSelect.builder.bind(FixedSelectFilter);

module.exports = FixedSelectFilter;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../filters":2,"./baseselect":6}],8:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);
var Filters = require('../filters');
var BaseSelect = require('./baseselect');

var MultiSelectFilter = $.extend({}, BaseSelect.SelectFilter, {

    /**
     * Initializes a multiselect dom object
     *
     * @returns {MultiSelectFilter}
     */
    init: function () {
        this.$dom = $('<select class="filtre"/>').attr('multiple', 'multiple');
        this.$dom.on('change', this._onChange.bind(this));

        return this;
    },

    /**
     * Populates the multiselect with 'selected' options by default
     *
     * @param data
     * @returns {MultiSelectFilter}
     */
    populate: function (data) {
        this._addOptions(data, this._addSelectedOption);
        this._onChange();

        return this;
    },

    /**
     * If the 'all' option is selected, sets the new options as 'selected'.
     * Otherwise, adds the options based on the filter state
     *
     * @param data
     * @returns {MultiSelectFilter}
     */
    update: function (data) {
        if ($.inArray(this.allText, this.selected) > -1 || this._getNotSelected().length == 0)
            this._addOptions(data, this._addSelectedOption);
        else
            this._addOptions(data, this._refreshOption);

        return this;
    },

    /**
     * This filter is dynamic, it can't be used for initial filtering
     *
     * @returns {string}
     */
    getInitialQuery: function() {
        return '';
    }
});

Filters.prototype.builders.multiselect = BaseSelect.builder.bind(MultiSelectFilter);

module.exports = MultiSelectFilter;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../filters":2,"./baseselect":6}],9:[function(require,module,exports){
(function (global){
'use strict';
var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);

var BootstrapRenderer = {
    render: function ($container, header, data) {
        this.populate(data);
        this.showFilter(this.$dom, $container, header, data);

        var defaultOptions = {
            buttonText: function (options) {
                var nbSelected = $(options).filter(':selected').length;
                if(nbSelected == 0) {
                    return header;
                }
                return header + ' (' + nbSelected + ')';
            }
        };

        this.$dom.multiselect($.extend(defaultOptions, this.rendererOptions));

        return this;
    },

    selectedQuery: function () {
        var $widget = this.$dom.multiselect();

        if ($.inArray($widget.selectAllText, $widget.val())) {
            return '';
        } else {
            return this._getSelection().map(function (value) {
                if (value == this.allText) {
                    return '';
                } else {
                    return '^' + $.fn.dataTable.util.escapeRegex(value) + '$';
                }
            }, this).join('|');
        }
    },

    showFilter: function($dom, $container, header, data) {
        $container.append(this.$dom);
    },

    refresh: function (data) {
        this.update(data);
        this.$dom.multiselect('rebuild');

        return this;
    }
};

module.exports = BootstrapRenderer;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],10:[function(require,module,exports){
(function (global){
'use strict';
var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);

var ChosenRenderer = {
    render: function ($container, header, data) {
        this.populate(data);
        this.showFilter(this.$dom, $container, header, data);
        this.$dom.chosen(this.rendererOptions || {});

        return this;
    },

    showFilter: function($dom, $container, header, data) {
        $container.append(this.$dom);
    },

    refresh: function (data) {
        this.update(data);
        this.$dom.trigger('chosen:updated');

        return this;
    }
};

module.exports = ChosenRenderer;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],11:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);
var Filters = require('../filters');
var BaseSelect = require('./baseselect');

var SimpleSelectFilter = $.extend({}, BaseSelect.SelectFilter, {

    /**
     * Creates a simple select
     *
     * @returns {SimpleSelectFilter}
     */
    init: function () {
        this.$dom = $('<select class="filtre"/>');
        this.$dom.on('change', this._onChange.bind(this));

        return this;
    },

    /**
     * Adds all options without specifying the 'selected' flag
     * (the first option is selected by default)
     *
     * @param data
     * @returns {SimpleSelectFilter}
     */
    populate: function (data) {
        this._addOptions(data, this._refreshOption);
        this._onChange();

        return this;
    },

    /**
     * Refresh the options based on the filter state
     *
     * @param data
     * @returns {SimpleSelectFilter}
     */
    update: function (data) {
        this._addOptions(data, this._refreshOption);

        return this;
    },

    /**
     * This filter is dynamic, it can't be used for initial filtering
     *
     * @returns {string}
     */
    getInitialQuery: function() {
        return '';
    }
});

Filters.prototype.builders.select = BaseSelect.builder.bind(SimpleSelectFilter);

module.exports = SimpleSelectFilter;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../filters":2,"./baseselect":6}]},{},[4])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9iYXNlZmlsdGVyLmpzIiwianMvZmlsdGVycy5qcyIsImpzL2lucHV0L2lucHV0LmpzIiwianMvbWFpbi5qcyIsImpzL3JlbmRlcmVyL3NpbXBsZS5qcyIsImpzL3NlbGVjdC9iYXNlc2VsZWN0LmpzIiwianMvc2VsZWN0L2ZpeGVkc2VsZWN0LmpzIiwianMvc2VsZWN0L211bHRpc2VsZWN0LmpzIiwianMvc2VsZWN0L3JlbmRlcmVyL2Jvb3RzdHJhcC5qcyIsImpzL3NlbGVjdC9yZW5kZXJlci9jaG9zZW4uanMiLCJqcy9zZWxlY3Qvc2ltcGxlc2VsZWN0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNqUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDckxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQzdEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WyckJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWyckJ10gOiBudWxsKTtcblxuLyoqXG4gKiBCYXNlRmlsdGVyXG4gKi9cbnZhciBCYXNlRmlsdGVyID0ge1xuXG4gICAgLyoqXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59IFdoZXRoZXIgYSBmaWx0ZXIgY2hhbmdlIG11c3QgdHJpZ2dlciBhIGRhdGF0YWJsZSByZWxvYWQuXG4gICAgICogRGVmYXVsdCBpcyBmYWxzZSAoY2xpZW50IHNpZGUgZmlsdGVyKS5cbiAgICAgKi9cbiAgICBpc1NlcnZlclNpZGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgcmVxdWVzdCBwYXJhbWV0ZXIgYXNzb2NpYXRlZCB3aXRoIHRoaXMgZmlsdGVyIChpbiB0aGUgZm9ybSBrZXk9cGFyYW0sXG4gICAgICogb25seSB1c2VkIGZvciBzZXJ2ZXIgc2lkZSBmaWx0ZXJzKVxuICAgICAqL1xuICAgIGdldFNlcnZlclF1ZXJ5OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAnJztcbiAgICB9LFxuXG4gICAgbm90aWZ5Q2hhbmdlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuJGRvbS50cmlnZ2VyKCd1cGRhdGUuZmlsdGVycy5kdCcsIHtcbiAgICAgICAgICAgIGZpbHRlcjogdGhpc1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHJldHVybnMge1N0cmluZ30gVGhlIGZpbHRlciBzdHJpbmcgdG8gYmUgYXBwbGllZCB0byB0aGUgZGF0YXRhYmxlIGNvbHVtblxuICAgICAqL1xuICAgIGdldFF1ZXJ5OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghdGhpcy5oYXNWYWx1ZSgpKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMubm9TZWxlY3Rpb25RdWVyeSgpO1xuXG4gICAgICAgIHJldHVybiB0aGlzLnNlbGVjdGVkUXVlcnkoKTtcbiAgICB9LFxuXG4gICAgcmVnaXN0ZXI6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuJGRvbS5vbigndXBkYXRlLmZpbHRlcnMuZHQnLCBjYWxsYmFjayk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBCYXNlRmlsdGVyOyIsIid1c2Ugc3RyaWN0JztcblxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XG5cbi8qKlxuICogRmlsdGVycyBpcyBhIGNvbXBvbmVudCB0aGF0IG1hbmFnZXMgYSBsaXN0IG9mIGZpbHRlcnMgb2JqZWN0IGluc2lkZVxuICogYSBkYXRhdGFibGUgaGVhZGVyIHJvdy5cbiAqXG4gKiBUaGlzIGNvbnN0cnVjdG9yIGJpbmRzIGxpc3RlbmVycyB0byB2YXJpb3VzIGRhdGF0YWJsZSBldmVudHMuXG4gKlxuICogQHBhcmFtIHNldHRpbmdzIHtPYmplY3R9IHNldHRpbmdzIG9iamVjdCB1c2VkIHRvIGNyZWF0ZSB0aGUgZGF0YXRhYmxlXG4gKi9cbnZhciBGaWx0ZXJzID0gZnVuY3Rpb24gKHNldHRpbmdzKSB7XG4gICAgdGhpcy50YWJsZUFQSSA9IG5ldyAkLmZuLmRhdGFUYWJsZS5BcGkoc2V0dGluZ3MpO1xuICAgIHRoaXMuJGhlYWRlciA9ICQodGhpcy50YWJsZUFQSS50YWJsZSgpLmhlYWRlcigpKTtcbiAgICB0aGlzLnVybCA9IHRoaXMudGFibGVBUEkuYWpheC51cmwoKTtcblxuICAgIHZhciBmaWx0ZXJzID0gW107XG4gICAgdmFyIGJ1aWxkZXJzID0gdGhpcy5idWlsZGVycztcbiAgICB2YXIgcmVuZGVyQ29sID0gMDtcbiAgICAkLmVhY2goc2V0dGluZ3MuYW9Db2x1bW5zLCBmdW5jdGlvbiAoY29sLCBwYXJhbSkge1xuICAgICAgICBpZiAocGFyYW0uZmlsdGVyKSB7XG4gICAgICAgICAgICB2YXIgb3B0aW9ucyA9ICQuZXh0ZW5kKHtcbiAgICAgICAgICAgICAgY29sdW1uOiBjb2wsXG4gICAgICAgICAgICAgIHJlbmRlckNvbHVtbjogcmVuZGVyQ29sXG4gICAgICAgICAgICB9LCBwYXJhbS5maWx0ZXIpO1xuICAgICAgICAgICAgZmlsdGVycy5wdXNoKGJ1aWxkZXJzW3BhcmFtLmZpbHRlci50eXBlXShvcHRpb25zKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYocGFyYW0uYlZpc2libGUpIHtcbiAgICAgICAgICByZW5kZXJDb2wrKztcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKGZpbHRlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICB0aGlzLmZpbHRlcnMgPSBmaWx0ZXJzO1xuICAgICAgICB0aGlzLmZpbHRlcnMuZm9yRWFjaChmdW5jdGlvbiAoZmlsdGVyKSB7XG4gICAgICAgICAgICBmaWx0ZXIuaW5pdCgpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5maWx0ZXJzLmZvckVhY2godGhpcy5hcHBseUluaXRpYWxGaWx0ZXIsIHRoaXMpO1xuICAgICAgICB0aGlzLnRhYmxlQVBJLm9uKCdpbml0JywgdGhpcy5vbkRhdGFUYWJsZUluaXQuYmluZCh0aGlzKSk7XG4gICAgfVxufTtcblxuJC5leHRlbmQoRmlsdGVycy5wcm90b3R5cGUsIHtcblxuICAgIC8qKlxuICAgICAqIEFycmF5IG9mIGZpbHRlciBjb25zdHJ1Y3RvciBmdW5jdGlvbi4gRWFjaCBmdW5jdGlvblxuICAgICAqIHRha2VzIGEgc2V0dGluZyBvYmplY3QgYXMgaXRzIHNpbmdsZSBwYXJhbWV0ZXJcbiAgICAgKi9cbiAgICBidWlsZGVyczoge30sXG5cbiAgICAvKipcbiAgICAgKiBUYWJsZSBoZWFkZXIgZG9tIG5vZGVcbiAgICAgKiBAdHlwZSB7alF1ZXJ5fVxuICAgICAqL1xuICAgICRoZWFkZXI6IG51bGwsXG5cbiAgICAvKipcbiAgICAgKiBGaWx0ZXJzIGFycmF5XG4gICAgICogQHR5cGUge0FycmF5fVxuICAgICAqL1xuICAgIGZpbHRlcnM6IFtdLFxuXG4gICAgLyoqXG4gICAgICogVGFibGUgaW5pdGlhbCBhamF4IFVSTFxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgdXJsOiAnJyxcblxuICAgIC8qKlxuICAgICAqIFJlZnJlc2hlcyBmaWx0ZXJzIGFmdGVyIGVhY2ggYWpheCByZXF1ZXN0XG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc31cbiAgICAgKi9cbiAgICByZWdpc3RlckFqYXhMaXN0ZW5lcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnRhYmxlQVBJLm9uKCd4aHInLCAkLnByb3h5KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMudGFibGVBUEkub25lKCdwcmVEcmF3JywgJC5wcm94eSh0aGlzLnJlZnJlc2hGaWx0ZXJzLCB0aGlzKSk7XG4gICAgICAgIH0sIHRoaXMpKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZXMgdGhlIGhlYWRlciBIVE1MIGVsZW1lbnRzIHRoYXQgd2lsbCBiZSB1c2VkIHRvIGhvbGQgdGhlIGZpbHRlcnMuXG4gICAgICogSXQgYWxzbyByZWdpc3RlcnMgdGhlIG1haW4gZXZlbnQgaGFuZGxlciB0aGF0IHdpbGwgcmVhY3QgdG8gdGhlIGZpbHRlcnMnXG4gICAgICogdmFsdWUgY2hhbmdlcy5cbiAgICAgKlxuICAgICAqIFRoZSBldmVudCBuYW1lIGlzIDxiPmZpbHRlckNoYW5nZTwvYj4uIFRoaXMgZXZlbnQgbXVzdCBiZSB0cmlnZ2VyZWQgYnkgdGhlXG4gICAgICogZmlsdGVycyB3aGVuIHRoZWlyIHZhbHVlIGlzIG1vZGlmaWVkIGJ5IHRoZSB1c2VyIChvciBhbnkgb3RoZXIgZXZlbnQgdGhhdFxuICAgICAqIHNob3VsZCB0cmlnZ2VyIGEgZGF0YXRhYmxlIGZpbHRlcikuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc31cbiAgICAgKi9cbiAgICBzZXR1cEhlYWRlclJvdzogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgJGZpbHRlckhlYWRlciA9ICQoJzx0ciBjbGFzcz1cImZpbHRlcnNcIj48L3RyPicpO1xuXG4gICAgICAgIHRoaXMudGFibGVBUEkuY29sdW1ucygnOnZpc2libGUnKS5oZWFkZXIoKS5lYWNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICRmaWx0ZXJIZWFkZXIuYXBwZW5kKCc8dGggY2xhc3M9XCJmb25kLWhlYWRlclwiPjwvdGg+Jyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuJGhlYWRlci5hcHBlbmQoJGZpbHRlckhlYWRlcik7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlZHJhd3MgdGhlIGRhdGF0YWJsZVxuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpbHRlcnN9XG4gICAgICovXG4gICAgZHJhd1RhYmxlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMudGFibGVBUEkuZHJhdygpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIGNvbHVtbiBkYXRhIChjdXJyZW50IGZpbHRlciBpcyBpZ25vcmVkKVxuICAgICAqXG4gICAgICogQHBhcmFtIGNvbCB7aW50fSBUaGUgY29sdW1uIGluZGV4ICgwIGJhc2VkKVxuICAgICAqXG4gICAgICogQHJldHVybiB7alF1ZXJ5fSBUaGUgdW5maWx0ZXJlZCBjb2x1bW4gcmVuZGVyZWQgZGF0YVxuICAgICAqL1xuICAgIGdldENvbHVtbkRhdGE6IGZ1bmN0aW9uIChjb2wpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGFibGVBUEkuY2VsbHMobnVsbCwgY29sKS5yZW5kZXIoJ2Rpc3BsYXknKS51bmlxdWUoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0cmlldmVzIHRoZSBjb2x1bW4gZmlsdGVyZWQgZGF0YVxuICAgICAqXG4gICAgICogQHBhcmFtIGNvbCB7aW50fSBUaGUgY29sdW1uIGluZGV4ICgwIGJhc2VkKVxuICAgICAqXG4gICAgICogQHJldHVybiB7alF1ZXJ5fSBUaGUgZmlsdGVyZWQgY29sdW1uIGRhdGFcbiAgICAgKi9cbiAgICBnZXRGaWx0ZXJlZENvbHVtbkRhdGE6IGZ1bmN0aW9uIChjb2wpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGFibGVBUEkuY29sdW1uKGNvbCwge3NlYXJjaDogJ2FwcGxpZWQnfSkuZGF0YSgpLnVuaXF1ZSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBY3Rpb25zIHRvIGV4ZWN1dGUgd2hlbiB0aGUgZGF0YXRhYmxlIGlzIGRvbmUgaW5pdGlhbGl6aW5nLlxuICAgICAqIENyZWF0ZXMgdGhlIGZpbHRlciBoZWFkZXIgcm93LCByZWdpc3RlcnMgYWpheCBsaXN0ZW5lcnMgYW5kXG4gICAgICogcmVuZGVycyBmaWx0ZXJzXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc31cbiAgICAgKi9cbiAgICBvbkRhdGFUYWJsZUluaXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5zZXR1cEhlYWRlclJvdygpLnJlZ2lzdGVyQWpheExpc3RlbmVyKCkucmVuZGVyRmlsdGVycygpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBXaGVuIGEgY2xpZW50LXNpZGUgZmlsdGVyIGNoYW5nZXMsIGFwcGxpZXMgaXRzIG5ldyB2YWx1ZVxuICAgICAqXG4gICAgICogQHBhcmFtIGV2ZW50IHtFdmVudH0gZXZlbnQgb2JqZWN0XG4gICAgICogQHBhcmFtIHBhcmFtcyB7T2JqZWN0fSBldmVudCBwYXJhbXNcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge0ZpbHRlcnN9XG4gICAgICovXG4gICAgb25DbGllbnRGaWx0ZXJDaGFuZ2U6IGZ1bmN0aW9uIChldmVudCwgcGFyYW1zKSB7XG4gICAgICAgIHRoaXMuYXBwbHlGaWx0ZXIocGFyYW1zLmZpbHRlcikuZHJhd1RhYmxlKCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFdoZW4gYSBzZXJ2ZXItc2lkZSBmaWx0ZXIgY2hhbmdlcywgYnVpbGRzIHRoZSBuZXcgYWpheCBxdWVyeSBhbmQgcmVmcmVzaGVzIHRoZSB0YWJsZVxuICAgICAqXG4gICAgICogQHJldHVybiB7RmlsdGVyc31cbiAgICAgKi9cbiAgICBvblNlcnZlckZpbHRlckNoYW5nZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgc2VydmVyUXVlcnkgPSAkLmdyZXAodGhpcy5maWx0ZXJzLCBmdW5jdGlvbiAoZmlsdGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gZmlsdGVyLmlzU2VydmVyU2lkZSgpO1xuICAgICAgICB9KS5tYXAoZnVuY3Rpb24gKGZpbHRlcikge1xuICAgICAgICAgICAgcmV0dXJuIGZpbHRlci5nZXRTZXJ2ZXJRdWVyeSgpO1xuICAgICAgICB9KS5qb2luKCcmJyk7XG5cbiAgICAgICAgdGhpcy50YWJsZUFQSS5hamF4LnVybCh0aGlzLnVybCArICc/JyArIHNlcnZlclF1ZXJ5KS5hamF4LnJlbG9hZCgpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBcHBsaWVzIHRoZSBmaWx0ZXIgdmFsdWUgdG8gdGhlIHJlbGF0ZWQgY29sdW1uXG4gICAgICpcbiAgICAgKiBAcGFyYW0gZmlsdGVyIFRoZSBmaWx0ZXIgb2JqZWN0XG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtGaWx0ZXJzfVxuICAgICAqL1xuICAgIGFwcGx5RmlsdGVyOiBmdW5jdGlvbiAoZmlsdGVyKSB7XG4gICAgICAgIHRoaXMudGFibGVBUEkuY29sdW1uKGZpbHRlci5jb2x1bW4pLnNlYXJjaChcbiAgICAgICAgICAgIGZpbHRlci5nZXRRdWVyeSgpLFxuICAgICAgICAgICAgZmlsdGVyLmlzUmVnZXhNYXRjaCgpXG4gICAgICAgICAgICAsIGZhbHNlKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogRW5hYmxlcyBmaWx0ZXJzIHRvIGFwcGx5IGFuIGluaXRpYWwgY29sdW1uIGZpbHRlciwgYmVmb3JlXG4gICAgICogYW55IGRhdGEgcHJvY2Vzc2luZy9kaXNwbGF5aW5nIGlzIGRvbmUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gZmlsdGVyXG4gICAgICogQHJldHVybnMge0ZpbHRlcnN9XG4gICAgICovXG4gICAgYXBwbHlJbml0aWFsRmlsdGVyOiBmdW5jdGlvbiAoZmlsdGVyKSB7XG4gICAgICAgIHRoaXMudGFibGVBUEkuY29sdW1uKGZpbHRlci5jb2x1bW4pLnNlYXJjaChcbiAgICAgICAgICAgIGZpbHRlci5nZXRJbml0aWFsUXVlcnkoKSxcbiAgICAgICAgICAgIGZpbHRlci5pc1JlZ2V4TWF0Y2goKVxuICAgICAgICAgICAgLCBmYWxzZSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBzZWUgdGhpcy5yZW5kZXJGaWx0ZXJcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfVxuICAgICAqL1xuICAgIHJlbmRlckZpbHRlcnM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5maWx0ZXJzLmZvckVhY2godGhpcy5yZW5kZXJGaWx0ZXIsIHRoaXMpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBc2tzIGEgZmlsdGVyIHRvIHJlbmRlciBpdHNlbGYgYW5kIHByb3ZpZGVzIGFuIG9wdGlvbmFsIGNvbnRhaW5lclxuICAgICAqIGZvciBmaWx0ZXJzIHRoYXQgbmVlZCB0byBiZSByZW5kZXJlZCBpbnNpZGUgdGhlIGRhdGF0YWJsZSBoZWFkZXIgcm93XG4gICAgICpcbiAgICAgKiBAcGFyYW0gZmlsdGVyIFRoZSBmaWx0ZXIgb2JqZWN0XG4gICAgICovXG4gICAgcmVuZGVyRmlsdGVyOiBmdW5jdGlvbiAoZmlsdGVyKSB7XG4gICAgICAgIHZhciBjb2wgPSBmaWx0ZXIuY29sdW1uO1xuICAgICAgICB2YXIgJGNvbEhlYWRlciA9ICQodGhpcy50YWJsZUFQSS5jb2x1bW4oY29sKS5oZWFkZXIoKSk7XG4gICAgICAgIHZhciAkY29udGFpbmVyID0gdGhpcy4kaGVhZGVyLmZpbmQoJy5mb25kLWhlYWRlcjplcSgnICsgZmlsdGVyLnJlbmRlckNvbHVtbiArICcpJyk7XG5cbiAgICAgICAgaWYgKGZpbHRlci5pc1NlcnZlclNpZGUoKSkge1xuICAgICAgICAgICAgZmlsdGVyLnJlZ2lzdGVyKCQucHJveHkodGhpcy5vblNlcnZlckZpbHRlckNoYW5nZSwgdGhpcykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZmlsdGVyLnJlZ2lzdGVyKCQucHJveHkodGhpcy5vbkNsaWVudEZpbHRlckNoYW5nZSwgdGhpcykpO1xuICAgICAgICB9XG5cbiAgICAgICAgZmlsdGVyLnJlbmRlcigkY29udGFpbmVyLCAkY29sSGVhZGVyLmh0bWwoKSwgdGhpcy5nZXRDb2x1bW5EYXRhKGNvbCkpO1xuICAgICAgICBpZihmaWx0ZXIuY2xhc3NOYW1lKSB7XG4gICAgICAgICAgZmlsdGVyLiRkb20uYWRkQ2xhc3MoZmlsdGVyLmNsYXNzTmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYoZmlsdGVyLmF0dHJzKSB7XG4gICAgICAgICAgZmlsdGVyLiRkb20uYXR0cihmaWx0ZXIuYXR0cnMpO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlZnJlc2hlcyB0aGUgZmlsdGVycyBiYXNlZCBvbiB0aGUgY3VycmVudGx5IGRpc3BsYXllZCBkYXRhIGZvciBlYWNoIGNvbHVtblxuICAgICAqXG4gICAgICogQHJldHVybiB7RmlsdGVyc31cbiAgICAgKi9cbiAgICByZWZyZXNoRmlsdGVyczogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLmZpbHRlcnMuZm9yRWFjaChmdW5jdGlvbiAoZmlsdGVyKSB7XG4gICAgICAgICAgICBmaWx0ZXIucmVmcmVzaCh0aGlzLmdldENvbHVtbkRhdGEoZmlsdGVyLmNvbHVtbikpO1xuICAgICAgICAgICAgdGhpcy5hcHBseUZpbHRlcihmaWx0ZXIpO1xuICAgICAgICB9LCB0aGlzKTtcblxuICAgICAgICB0aGlzLmRyYXdUYWJsZSgpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn0pO1xuXG4kKGRvY3VtZW50KS5vbigncHJlSW5pdC5kdCcsIGZ1bmN0aW9uIChlLCBzZXR0aW5ncykge1xuICAgIG5ldyBGaWx0ZXJzKHNldHRpbmdzKTtcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZpbHRlcnM7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xudmFyIEJhc2VGaWx0ZXIgPSByZXF1aXJlKCcuLi9iYXNlZmlsdGVyJyk7XG52YXIgU2ltcGxlUmVuZGVyZXIgPSByZXF1aXJlKCcuLi9yZW5kZXJlci9zaW1wbGUnKTtcbnZhciBGaWx0ZXJzID0gcmVxdWlyZSgnLi4vZmlsdGVycycpO1xuXG52YXIgSW5wdXRGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZUZpbHRlciwgU2ltcGxlUmVuZGVyZXIsIHtcblxuICAgIGluaXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy4kZG9tID0gJCgnPGlucHV0IGNsYXNzPVwiZmlsdHJlXCIvPicpO1xuICAgICAgICB0aGlzLiRkb20ub24oJ2lucHV0JywgdGhpcy5ub3RpZnlDaGFuZ2UuYmluZCh0aGlzKSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIHBvcHVsYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICB1cGRhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIG5vU2VsZWN0aW9uUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH0sXG5cbiAgICBpc1JlZ2V4TWF0Y2g6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcblxuICAgIGhhc1ZhbHVlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiRkb20udmFsKCkgIT0gJyc7XG4gICAgfSxcblxuICAgIHNlbGVjdGVkUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuJGRvbS52YWwoKTtcbiAgICB9LFxuXG4gICAgZ2V0SW5pdGlhbFF1ZXJ5OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAnJztcbiAgICB9XG59KTtcblxuRmlsdGVycy5wcm90b3R5cGUuYnVpbGRlcnMuaW5wdXQgPSBmdW5jdGlvbihzZXR0aW5ncykge1xuICByZXR1cm4gJC5leHRlbmQoe30sIElucHV0RmlsdGVyLCBzZXR0aW5ncyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IElucHV0RmlsdGVyOyIsIid1c2Ugc3RyaWN0JztcblxucmVxdWlyZSgnLi9zZWxlY3Qvc2ltcGxlc2VsZWN0Jyk7XG5yZXF1aXJlKCcuL3NlbGVjdC9tdWx0aXNlbGVjdCcpO1xucmVxdWlyZSgnLi9zZWxlY3QvZml4ZWRzZWxlY3QnKTtcbnJlcXVpcmUoJy4vaW5wdXQvaW5wdXQnKTtcbnJlcXVpcmUoJy4vZmlsdGVycycpOyIsIid1c2Ugc3RyaWN0JztcblxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XG5cbnZhciBTaW1wbGVSZW5kZXJlciA9IHtcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpIHtcbiAgICAgICAgdGhpcy5wb3B1bGF0ZShkYXRhKTtcbiAgICAgICAgdGhpcy5zaG93RmlsdGVyKHRoaXMuJGRvbSwgJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgc2hvd0ZpbHRlcjogZnVuY3Rpb24oJGRvbSwgJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKSB7XG4gICAgICAgICRjb250YWluZXIuYXBwZW5kKHRoaXMuJGRvbSk7XG4gICAgICAgIHRoaXMuJGRvbS5hdHRyKCduYW1lJywgaGVhZGVyKS5hdHRyKCdwbGFjZWhvbGRlcicsIGhlYWRlcikuc2hvdygpO1xuICAgIH0sXG5cbiAgICByZWZyZXNoOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB0aGlzLnVwZGF0ZShkYXRhKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNpbXBsZVJlbmRlcmVyOyIsIid1c2Ugc3RyaWN0JztcblxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XG52YXIgQmFzZUZpbHRlciA9IHJlcXVpcmUoJy4uL2Jhc2VmaWx0ZXInKTtcbnZhciBTaW1wbGVSZW5kZXJlciA9IHJlcXVpcmUoJy4uL3JlbmRlcmVyL3NpbXBsZScpO1xudmFyIEJvb3RzdHJhcFJlbmRlcmVyID0gcmVxdWlyZSgnLi9yZW5kZXJlci9ib290c3RyYXAnKTtcbnZhciBDaG9zZW5SZW5kZXIgPSByZXF1aXJlKCcuL3JlbmRlcmVyL2Nob3NlbicpO1xuXG4vKipcbiAqIFNlbGVjdEZpbHRlciByZWdyb3VwcyBjb21tb24gYmVoYXZpb3IgZm9yIHNlbGVjdCBmaWx0ZXJzXG4gKi9cbnZhciBTZWxlY3RGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZUZpbHRlciwge1xuICAgIHNlbGVjdGVkOiBbXSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgYW4gYWx3YXlzIGZhbHNlIHJlZ2V4IHRvIGhpZGUgZXZlcnkgcmVjb3Jkc1xuICAgICAqIHdoZW4gbm8gb3B0aW9uIGlzIHNlbGVjdGVkXG4gICAgICovXG4gICAgbm9TZWxlY3Rpb25RdWVyeTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJyQuXic7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlLiBTZWxlY3QgZmlsdGVycyBhbHdheXMgdXNlIHJlZ2V4XG4gICAgICovXG4gICAgaXNSZWdleE1hdGNoOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyB0cnVlIGlmIGF0IGxlYXN0IG9uZSBvcHRpb24gaXMgc2VsZWN0ZWRcbiAgICAgKi9cbiAgICBoYXNWYWx1ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0U2VsZWN0aW9uKCkubGVuZ3RoID4gMDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHJldHVybnMge1N0cmluZ30gVGhlIGNvbHVtbiBmaWx0ZXIgcXVlcnkgdG8gYXBwbHkuIFNlbGVjdGVkIG9wdGlvbiB2YWx1ZXNcbiAgICAgKiBhcmUgY29uY2F0ZW5hdGVkIGludG8gYSBzdHJpbmcgdXNpbmcgdGhlIHBpcGUgY2hhcmFjdGVyIChyZWdleCBvcilcbiAgICAgKi9cbiAgICBzZWxlY3RlZFF1ZXJ5OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRTZWxlY3Rpb24oKS5tYXAoZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAodmFsdWUgPT0gdGhpcy5hbGxUZXh0ICB8fCB0aGlzLl9nZXROb3RTZWxlY3RlZCgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICdeJyArICQuZm4uZGF0YVRhYmxlLnV0aWwuZXNjYXBlUmVnZXgodmFsdWUpICsgJyQnO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0aGlzKS5qb2luKCd8Jyk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEZpbHRlcnMgdGhlIG9wdGlvbnMgYmVmb3JlIGFkZGluZyB0aGVtIHRvIHRoZSBzZWxlY3QuIENhbiBiZSBvdmVycmlkZGVuXG4gICAgICogZm9yIHNwZWNpZmljIGZpbHRlcmluZ1xuICAgICAqXG4gICAgICogQHBhcmFtIHZhbHVlIHtTdHJpbmd9IE9wdGlvbiB2YWx1ZVxuICAgICAqL1xuICAgIGZpbHRlck9wdGlvbnM6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWUudHJpbSgpICE9ICcnO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTb3J0IHRoZSBvcHRpb25zIGJlZm9yZSBhZGRpbmcgdGhlbSB0byB0aGUgc2VsZWN0LiBDYW4gYmUgb3ZlcnJpZGRlbiBmb3JcbiAgICAgKiBzcGVjaWZpYyBzb3J0c1xuICAgICAqL1xuICAgIHNvcnRPcHRpb25zOiBmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICBpZiAoYSA+IGIpIHtcbiAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGEgPCBiKSB7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gMDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHJldHVybnMge0FycmF5PFN0cmluZz59IFRoZSBhcnJheSBvZiBzZWxlY3RlZCB2YWx1ZXNcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9nZXRTZWxlY3Rpb246IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuJGRvbS5maW5kKCdvcHRpb246c2VsZWN0ZWQnKS50b0FycmF5KCkubWFwKGZ1bmN0aW9uKG9wdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbi52YWx1ZTtcbiAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHJldHVybnMgeyp8QXJyYXl9IFRoZSBhcnJheSBvZiBub24gc2VsZWN0ZWQgdmFsdWVzXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0Tm90U2VsZWN0ZWQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy4kZG9tLmZpbmQoJzpub3Qob3B0aW9uOnNlbGVjdGVkKScpLnRvQXJyYXkoKS5tYXAoZnVuY3Rpb24ob3B0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gb3B0aW9uLnZhbHVlO1xuICAgICAgICB9KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogRm9yIGVhY2ggZWxlbWVudCBpbiB0aGUgZGF0YSBvYmplY3QsIGNyZWF0ZXMgYW4gb3B0aW9uIGVsZW1lbnQgdXNpbmcgdGhlIGZ1bmN0aW9uXG4gICAgICogZm5DcmVhdGVcbiAgICAgKlxuICAgICAqIEBwYXJhbSBkYXRhIHtqUXVlcnl9IFRoZSBkYXRhIHRvIGFkZCB0byB0aGUgc2VsZWN0XG4gICAgICogQHBhcmFtIGZuQ3JlYXRlIHtGdW5jdGlvbn0gVGhlIGZ1bmN0aW9uIHRvIHVzZSB0byBjcmVhdGUgdGhlIG9wdGlvbnNcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hZGRPcHRpb25zOiBmdW5jdGlvbiAoZGF0YSwgZm5DcmVhdGUpIHtcbiAgICAgICAgdGhpcy4kZG9tLmVtcHR5KCk7XG5cbiAgICAgICAgaWYgKHRoaXMuYWxsVGV4dClcbiAgICAgICAgICAgIGZuQ3JlYXRlLmNhbGwodGhpcywgdGhpcy5hbGxUZXh0KTtcblxuICAgICAgICBkYXRhLnRvQXJyYXkoKS5maWx0ZXIodGhpcy5maWx0ZXJPcHRpb25zKS5zb3J0KHRoaXMuc29ydE9wdGlvbnMpLmZvckVhY2goZm5DcmVhdGUsIHRoaXMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgc2VsZWN0ZWQgb3B0aW9uXG4gICAgICpcbiAgICAgKiBAcGFyYW0gdmFsdWUge1N0cmluZ30gVGhlIG9wdGlvbiB2YWx1ZVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2FkZFNlbGVjdGVkT3B0aW9uOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgdGhpcy4kZG9tLmFwcGVuZCgkKCc8b3B0aW9uLz4nKVxuICAgICAgICAgICAgLnZhbCh2YWx1ZSlcbiAgICAgICAgICAgIC50ZXh0KHZhbHVlKVxuICAgICAgICAgICAgLmF0dHIoJ3NlbGVjdGVkJywgJ3NlbGVjdGVkJylcbiAgICAgICAgKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbiBvcHRpb24gd2l0aCB0aGUgc2VsZWN0ZWQgZmxhZyBiYXNlZCBvbiB0aGVcbiAgICAgKiBjdXJyZW50IGZpbHRlciBzdGF0ZVxuICAgICAqXG4gICAgICogQHBhcmFtIHZhbHVlIHtTdHJpbmd9IFRoZSBvcHRpb24gdmFsdWVcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9yZWZyZXNoT3B0aW9uOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgdmFyICRvcHRpb24gPSAkKCc8b3B0aW9uLz4nKVxuICAgICAgICAgICAgLnZhbCh2YWx1ZSlcbiAgICAgICAgICAgIC50ZXh0KHZhbHVlKTtcblxuICAgICAgICBpZiAoJC5pbkFycmF5KHZhbHVlLCB0aGlzLnNlbGVjdGVkKSA+IC0xKVxuICAgICAgICAgICAgJG9wdGlvbi5hdHRyKCdzZWxlY3RlZCcsICdzZWxlY3RlZCcpO1xuXG4gICAgICAgIHRoaXMuJGRvbS5hcHBlbmQoJG9wdGlvbik7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFRha2VzIGEgc25hcHNob3Qgb2YgdGhlIGN1cnJlbnQgc2VsZWN0aW9uIHN0YXRlXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zYXZlU2VsZWN0aW9uOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5zZWxlY3RlZCA9IHRoaXMuX2dldFNlbGVjdGlvbigpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBXaGVuZXZlciB0aGUgc2VsZWN0IHN0YXRlIGNoYW5nZXMsIHNhdmUgaXRzIG5ldyBzdGF0ZSBhbmRcbiAgICAgKiBub3RpZnkgdGhlIGxpc3RlbmluZyBjb21wb25lbnRcbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uQ2hhbmdlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5fc2F2ZVNlbGVjdGlvbigpO1xuICAgICAgICB0aGlzLm5vdGlmeUNoYW5nZSgpO1xuICAgIH1cbn0pO1xuXG4gdmFyIGF2YWlsYWJsZVJlbmRlcmVycyA9IHtcbiAgICAnYm9vdHN0cmFwJzogQm9vdHN0cmFwUmVuZGVyZXIsXG4gICAgJ2Nob3Nlbic6IENob3NlblJlbmRlclxufTtcblxudmFyIGJ1aWxkZXIgPSBmdW5jdGlvbihzZXR0aW5ncykge1xuICAgIHZhciByZW5kZXJlciA9IGF2YWlsYWJsZVJlbmRlcmVyc1tzZXR0aW5ncy5yZW5kZXJlcl0gfHwgU2ltcGxlUmVuZGVyZXI7XG5cbiAgICByZXR1cm4gJC5leHRlbmQoe30sIHRoaXMsIHJlbmRlcmVyLCBzZXR0aW5ncyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBTZWxlY3RGaWx0ZXI6IFNlbGVjdEZpbHRlcixcbiAgICBidWlsZGVyOiBidWlsZGVyXG59OyIsIid1c2Ugc3RyaWN0JztcblxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XG52YXIgRmlsdGVycyA9IHJlcXVpcmUoJy4uL2ZpbHRlcnMnKTtcbnZhciBCYXNlU2VsZWN0ID0gcmVxdWlyZSgnLi9iYXNlc2VsZWN0Jyk7XG5cbnZhciBGaXhlZFNlbGVjdEZpbHRlciA9ICQuZXh0ZW5kKHt9LCBCYXNlU2VsZWN0LlNlbGVjdEZpbHRlciwge1xuXG4gICAgLyoqXG4gICAgICogU2ltcGx5IHNhdmVzIGEgaGFuZGxlIG9uIHRoZSBwcm92aWRlZCBzb3VyY2Ugc2VsZWN0XG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Rml4ZWRTZWxlY3RGaWx0ZXJ9XG4gICAgICovXG4gICAgaW5pdDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLiRkb20gPSAkKHRoaXMuc3JjKTtcbiAgICAgICAgdGhpcy4kZG9tLm9uKCdjaGFuZ2UnLCB0aGlzLm5vdGlmeUNoYW5nZS5iaW5kKHRoaXMpKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogTm8gYWN0aW9uIGZvciBmaXhlZCBmaWx0ZXJzOiB0aGUgcHJvdmlkZWQgc2VsZWN0IGlzIHVzZWQgYXMgaXNcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtGaXhlZFNlbGVjdEZpbHRlcn1cbiAgICAgKi9cbiAgICBwb3B1bGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogTm8gdXBkYXRlIGZvciBmaXhlZCBmaWx0ZXJzOiB0aGUgcHJvdmlkZWQgc2VsZWN0IGlzIG5ldmVyIGNoYW5nZWRcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtGaXhlZFNlbGVjdEZpbHRlcn1cbiAgICAgKi9cbiAgICB1cGRhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEZpeGVkIGZpbHRlcnMgY2FuIGJlIHVzZWQgdG8gcHJvdmlkZSBpbml0aWFsIGZpbHRlcnMgdG8gYXBwbHkgdG8gdGhlXG4gICAgICogZGF0YXRhYmxlLlxuICAgICAqXG4gICAgICogQHJldHVybnMgeyp8U3RyaW5nfVxuICAgICAqL1xuICAgIGdldEluaXRpYWxRdWVyeTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFF1ZXJ5KCk7XG4gICAgfVxufSk7XG5cbkZpbHRlcnMucHJvdG90eXBlLmJ1aWxkZXJzLmZpeGVkc2VsZWN0ID0gQmFzZVNlbGVjdC5idWlsZGVyLmJpbmQoRml4ZWRTZWxlY3RGaWx0ZXIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZpeGVkU2VsZWN0RmlsdGVyOyIsIid1c2Ugc3RyaWN0JztcblxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XG52YXIgRmlsdGVycyA9IHJlcXVpcmUoJy4uL2ZpbHRlcnMnKTtcbnZhciBCYXNlU2VsZWN0ID0gcmVxdWlyZSgnLi9iYXNlc2VsZWN0Jyk7XG5cbnZhciBNdWx0aVNlbGVjdEZpbHRlciA9ICQuZXh0ZW5kKHt9LCBCYXNlU2VsZWN0LlNlbGVjdEZpbHRlciwge1xuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZXMgYSBtdWx0aXNlbGVjdCBkb20gb2JqZWN0XG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7TXVsdGlTZWxlY3RGaWx0ZXJ9XG4gICAgICovXG4gICAgaW5pdDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLiRkb20gPSAkKCc8c2VsZWN0IGNsYXNzPVwiZmlsdHJlXCIvPicpLmF0dHIoJ211bHRpcGxlJywgJ211bHRpcGxlJyk7XG4gICAgICAgIHRoaXMuJGRvbS5vbignY2hhbmdlJywgdGhpcy5fb25DaGFuZ2UuYmluZCh0aGlzKSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFBvcHVsYXRlcyB0aGUgbXVsdGlzZWxlY3Qgd2l0aCAnc2VsZWN0ZWQnIG9wdGlvbnMgYnkgZGVmYXVsdFxuICAgICAqXG4gICAgICogQHBhcmFtIGRhdGFcbiAgICAgKiBAcmV0dXJucyB7TXVsdGlTZWxlY3RGaWx0ZXJ9XG4gICAgICovXG4gICAgcG9wdWxhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHRoaXMuX2FkZE9wdGlvbnMoZGF0YSwgdGhpcy5fYWRkU2VsZWN0ZWRPcHRpb24pO1xuICAgICAgICB0aGlzLl9vbkNoYW5nZSgpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBJZiB0aGUgJ2FsbCcgb3B0aW9uIGlzIHNlbGVjdGVkLCBzZXRzIHRoZSBuZXcgb3B0aW9ucyBhcyAnc2VsZWN0ZWQnLlxuICAgICAqIE90aGVyd2lzZSwgYWRkcyB0aGUgb3B0aW9ucyBiYXNlZCBvbiB0aGUgZmlsdGVyIHN0YXRlXG4gICAgICpcbiAgICAgKiBAcGFyYW0gZGF0YVxuICAgICAqIEByZXR1cm5zIHtNdWx0aVNlbGVjdEZpbHRlcn1cbiAgICAgKi9cbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIGlmICgkLmluQXJyYXkodGhpcy5hbGxUZXh0LCB0aGlzLnNlbGVjdGVkKSA+IC0xIHx8IHRoaXMuX2dldE5vdFNlbGVjdGVkKCkubGVuZ3RoID09IDApXG4gICAgICAgICAgICB0aGlzLl9hZGRPcHRpb25zKGRhdGEsIHRoaXMuX2FkZFNlbGVjdGVkT3B0aW9uKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgdGhpcy5fYWRkT3B0aW9ucyhkYXRhLCB0aGlzLl9yZWZyZXNoT3B0aW9uKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogVGhpcyBmaWx0ZXIgaXMgZHluYW1pYywgaXQgY2FuJ3QgYmUgdXNlZCBmb3IgaW5pdGlhbCBmaWx0ZXJpbmdcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9XG4gICAgICovXG4gICAgZ2V0SW5pdGlhbFF1ZXJ5OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH1cbn0pO1xuXG5GaWx0ZXJzLnByb3RvdHlwZS5idWlsZGVycy5tdWx0aXNlbGVjdCA9IEJhc2VTZWxlY3QuYnVpbGRlci5iaW5kKE11bHRpU2VsZWN0RmlsdGVyKTtcblxubW9kdWxlLmV4cG9ydHMgPSBNdWx0aVNlbGVjdEZpbHRlcjsiLCIndXNlIHN0cmljdCc7XG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WyckJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWyckJ10gOiBudWxsKTtcblxudmFyIEJvb3RzdHJhcFJlbmRlcmVyID0ge1xuICAgIHJlbmRlcjogZnVuY3Rpb24gKCRjb250YWluZXIsIGhlYWRlciwgZGF0YSkge1xuICAgICAgICB0aGlzLnBvcHVsYXRlKGRhdGEpO1xuICAgICAgICB0aGlzLnNob3dGaWx0ZXIodGhpcy4kZG9tLCAkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpO1xuXG4gICAgICAgIHZhciBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICAgICAgICAgIGJ1dHRvblRleHQ6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgdmFyIG5iU2VsZWN0ZWQgPSAkKG9wdGlvbnMpLmZpbHRlcignOnNlbGVjdGVkJykubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGlmKG5iU2VsZWN0ZWQgPT0gMCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaGVhZGVyO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gaGVhZGVyICsgJyAoJyArIG5iU2VsZWN0ZWQgKyAnKSc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy4kZG9tLm11bHRpc2VsZWN0KCQuZXh0ZW5kKGRlZmF1bHRPcHRpb25zLCB0aGlzLnJlbmRlcmVyT3B0aW9ucykpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBzZWxlY3RlZFF1ZXJ5OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciAkd2lkZ2V0ID0gdGhpcy4kZG9tLm11bHRpc2VsZWN0KCk7XG5cbiAgICAgICAgaWYgKCQuaW5BcnJheSgkd2lkZ2V0LnNlbGVjdEFsbFRleHQsICR3aWRnZXQudmFsKCkpKSB7XG4gICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fZ2V0U2VsZWN0aW9uKCkubWFwKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGlmICh2YWx1ZSA9PSB0aGlzLmFsbFRleHQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnXicgKyAkLmZuLmRhdGFUYWJsZS51dGlsLmVzY2FwZVJlZ2V4KHZhbHVlKSArICckJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LCB0aGlzKS5qb2luKCd8Jyk7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgc2hvd0ZpbHRlcjogZnVuY3Rpb24oJGRvbSwgJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKSB7XG4gICAgICAgICRjb250YWluZXIuYXBwZW5kKHRoaXMuJGRvbSk7XG4gICAgfSxcblxuICAgIHJlZnJlc2g6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHRoaXMudXBkYXRlKGRhdGEpO1xuICAgICAgICB0aGlzLiRkb20ubXVsdGlzZWxlY3QoJ3JlYnVpbGQnKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJvb3RzdHJhcFJlbmRlcmVyOyIsIid1c2Ugc3RyaWN0JztcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xuXG52YXIgQ2hvc2VuUmVuZGVyZXIgPSB7XG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKSB7XG4gICAgICAgIHRoaXMucG9wdWxhdGUoZGF0YSk7XG4gICAgICAgIHRoaXMuc2hvd0ZpbHRlcih0aGlzLiRkb20sICRjb250YWluZXIsIGhlYWRlciwgZGF0YSk7XG4gICAgICAgIHRoaXMuJGRvbS5jaG9zZW4odGhpcy5yZW5kZXJlck9wdGlvbnMgfHwge30pO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBzaG93RmlsdGVyOiBmdW5jdGlvbigkZG9tLCAkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpIHtcbiAgICAgICAgJGNvbnRhaW5lci5hcHBlbmQodGhpcy4kZG9tKTtcbiAgICB9LFxuXG4gICAgcmVmcmVzaDogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdGhpcy51cGRhdGUoZGF0YSk7XG4gICAgICAgIHRoaXMuJGRvbS50cmlnZ2VyKCdjaG9zZW46dXBkYXRlZCcpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2hvc2VuUmVuZGVyZXI7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WyckJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWyckJ10gOiBudWxsKTtcbnZhciBGaWx0ZXJzID0gcmVxdWlyZSgnLi4vZmlsdGVycycpO1xudmFyIEJhc2VTZWxlY3QgPSByZXF1aXJlKCcuL2Jhc2VzZWxlY3QnKTtcblxudmFyIFNpbXBsZVNlbGVjdEZpbHRlciA9ICQuZXh0ZW5kKHt9LCBCYXNlU2VsZWN0LlNlbGVjdEZpbHRlciwge1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIHNpbXBsZSBzZWxlY3RcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtTaW1wbGVTZWxlY3RGaWx0ZXJ9XG4gICAgICovXG4gICAgaW5pdDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLiRkb20gPSAkKCc8c2VsZWN0IGNsYXNzPVwiZmlsdHJlXCIvPicpO1xuICAgICAgICB0aGlzLiRkb20ub24oJ2NoYW5nZScsIHRoaXMuX29uQ2hhbmdlLmJpbmQodGhpcykpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGFsbCBvcHRpb25zIHdpdGhvdXQgc3BlY2lmeWluZyB0aGUgJ3NlbGVjdGVkJyBmbGFnXG4gICAgICogKHRoZSBmaXJzdCBvcHRpb24gaXMgc2VsZWN0ZWQgYnkgZGVmYXVsdClcbiAgICAgKlxuICAgICAqIEBwYXJhbSBkYXRhXG4gICAgICogQHJldHVybnMge1NpbXBsZVNlbGVjdEZpbHRlcn1cbiAgICAgKi9cbiAgICBwb3B1bGF0ZTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdGhpcy5fYWRkT3B0aW9ucyhkYXRhLCB0aGlzLl9yZWZyZXNoT3B0aW9uKTtcbiAgICAgICAgdGhpcy5fb25DaGFuZ2UoKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVmcmVzaCB0aGUgb3B0aW9ucyBiYXNlZCBvbiB0aGUgZmlsdGVyIHN0YXRlXG4gICAgICpcbiAgICAgKiBAcGFyYW0gZGF0YVxuICAgICAqIEByZXR1cm5zIHtTaW1wbGVTZWxlY3RGaWx0ZXJ9XG4gICAgICovXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB0aGlzLl9hZGRPcHRpb25zKGRhdGEsIHRoaXMuX3JlZnJlc2hPcHRpb24pO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBUaGlzIGZpbHRlciBpcyBkeW5hbWljLCBpdCBjYW4ndCBiZSB1c2VkIGZvciBpbml0aWFsIGZpbHRlcmluZ1xuICAgICAqXG4gICAgICogQHJldHVybnMge3N0cmluZ31cbiAgICAgKi9cbiAgICBnZXRJbml0aWFsUXVlcnk6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gJyc7XG4gICAgfVxufSk7XG5cbkZpbHRlcnMucHJvdG90eXBlLmJ1aWxkZXJzLnNlbGVjdCA9IEJhc2VTZWxlY3QuYnVpbGRlci5iaW5kKFNpbXBsZVNlbGVjdEZpbHRlcik7XG5cbm1vZHVsZS5leHBvcnRzID0gU2ltcGxlU2VsZWN0RmlsdGVyOyJdfQ==
