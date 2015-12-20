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
                        type: 'selectBootstrap',
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
                        type: 'multiselectBootstrap',
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
                        type: 'multiselectBootstrap',
                        options: {
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