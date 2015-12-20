'use strict';

var BootstrapRenderer = {
    render: function ($container, header, data) {
        this.populate(data);
        $container.append(this.$dom);
        this.$dom.multiselect();

        return this;
    },

    refresh: function (data) {
        this.update(data);
        this.$dom.multiselect('rebuild');

        return this;
    }
};

module.exports = BootstrapRenderer;