(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['jquery', 'datatables', './basefilter'], function ($) {
            return factory($);
        });
    }
    else {
        // Browser
        factory(jQuery);
    }
}(function ($) {
    'use strict';

    /**
     * InputFilter
     *
     * Simple input text filter
     *
     */
    var InputFilter = function (config) {
        $.extend(this, config);

        this.$dom = $('<input type="text" class="filtre"></input>').on('input', $.proxy(function () {
            this.notifyChange();
        }, this));
    };

    $.extend(InputFilter.prototype, $.fn.dataTable.BaseFilter, {

        render: function ($container, header) {
            this.$dom.attr('placeholder', header);
            this.showFilter(this.$dom, $container, header);
        },

        getQuery: function () {
            return this.$dom.val();
        }
    });

    $.fn.dataTable.InputFilter = InputFilter;
    $.fn.DataTable.InputFilter = InputFilter;

    return InputFilter;
}));