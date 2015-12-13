var $ = require('jquery');
require('../js/main');

$(document).ready(function () {
        var table = $('#exampleTable').DataTable({
            ajax: {
                url: "./data.json"
            },
            sAjaxDataProp: '',
            columns: [
                {
                    data: 'email',
                    filter: {
                        type: 'select',
                        options: {
                            allText: 'All emails'
                        }
                    }
                },
                {
                    data: 'name',
                    filter: {
                        type: 'input'
                    }
                },
                {
                    data: 'gender',
                    filter: {
                        type: 'multiselect',
                        options: {
                            filterOptions: function (option) {
                                return option != 'N/A';
                            }
                        }
                    }
                },
                {
                    data: 'company',
                    filter: {
                        type: 'multiselect',
                        options: {
                            allText: 'Tous',
                            showFilter: function ($dom) {
                                $('#cityFilter').append($dom);
                            }
                        }
                    }
                }
            ]
        });

        $('#reloadAjax').click(function () {
            table.ajax.url('./data2.json').ajax.reload();
        });
    }
);