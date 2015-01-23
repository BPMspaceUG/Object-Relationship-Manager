/*

Siesta 1.2.1
Copyright(c) 2009-2013 Bryntum AB
http://bryntum.com/contact
http://bryntum.com/products/siesta/license

*/
Ext.define('Siesta.Harness.Browser.UI.TestGrid', {
    extend      : 'Ext.tree.Panel',
    alias       : 'widget.testgrid',

    // TODO seems there's 4.2.0 bug related to stateful
    stateful    : false,
    forceFit    : true,
    rootVisible : false,
    
    cls         : 'tr-testgrid',
    width       : 300,
    
    filter      : null,
    
    title       : 'Double click a test to run it',
    
    filterGroups    : false,
    

    initComponent : function () {
        var me = this;

        Ext.apply(this, {
            
            viewType        : 'filterabletreeview',
            viewConfig : {
                store                   : this.store.nodeStore,
                enableTextSelection     : true,
                toggleOnDblClick        : false,

                // HACK, prevent layouts on update of a row
                onUpdate                : function () {
                    this.refreshSize    = Ext.emptyFn;
                    var val             = Ext.tree.View.prototype.onUpdate.apply(this, arguments);
                    this.refreshSize    = Ext.tree.View.prototype.refreshSize;

                    return val;
                }
            },
        
            columns     : [
                { 
                    xtype       : 'treecolumn',
                    header      : 'Name',
                    sortable    : false,
                
                    dataIndex   : 'title',
                
                    width: 180, 
                    renderer    : this.treeColumnRenderer,
                    scope       : this
                },
                { header: 'Passed', width: 40, sortable: false, dataIndex: 'passCount', align : 'center', renderer : this.passedColumnRenderer, scope : this },
                { header: 'Failed', width: 40, sortable: false, dataIndex: 'failCount', align : 'center', renderer : this.failedColumnRenderer, scope : this },
                { header: 'Time', width: 50, sortable: false, dataIndex: 'time', align : 'center', hidden : true }
            ],
            tools : [
                {
                    type            : 'down',
                    tooltip         : 'Expand all',
                    tooltipType     : 'title',
                    scope           : this,                                    
                    handler         : this.onExpandAll
                },
                {
                    type            : 'up',
                    tooltipType     : 'title',
                    tooltip         : 'Collapse all',
                    scope           : this,                                    
                    handler         : this.onCollapseAll
                }
            ],
            
            tbar : [
                '->',
                {
                    xtype       : 'triggerfield',
                    emptyText   : 'Filter tests',
                    
                    itemId      : 'trigger',
                    
                    width       : 180,
                    
                    trigger1Cls : 'x-form-clear-trigger',
                    trigger2Cls : 'tr-filter-trigger-leaf',
                    
                    onTrigger1Click  : function() {
                        this.reset()
                    },
                    
                    onTrigger2Click  : function() {
                        me.filterGroups  = !me.filterGroups
                        
                        this.triggerEl.item(1).toggleCls('tr-filter-trigger-group')
                        
                        me.onFilterChange(this, this.getValue())
                        
                        me.fireEvent('filter-group-change', me)
                    },
                    
                    
                    listeners   : {
                        change          : this.onFilterChange,
                        specialkey      : this.onFilterSpecialKey,
                        scope           : this,
                        
                        buffer          : 400
                    }
                }
            ]
        })
    
        this.callParent(arguments);
        
        var me      = this
        
        this.getView().on('beforerefresh', function () {
            var trigger     = me.down('trigger')
            
            if (me.filterGroups)    trigger.triggerEl.item(1).addCls('tr-filter-trigger-group')
            if (me.filter)          trigger.setValue(me.filter)
            
            // fixes wrong widths of the columns
            // TODO remove after upgrade of UI to 4.2.1 or later
            if (!me.filter) setTimeout(function () {
                me.doLayout()
            }, 10)
            
            // cancel refresh if there's a filter - in this case an additional refresh will be triggered by 
            // the filtering which will be already not canceled since this is 1 time listener
            return !me.filter
        }, null, { single : true })
    },
    
    onFilterSpecialKey : function(field, e, t) {
        if (e.keyCode === e.ESC) {
            field.reset();
        }
    },
    
    
    getFilterValue : function () {
        return this.down('trigger').getValue()
    },
    
    
    getFilterGroups : function () {
        return this.filterGroups
    },
    
    
    onFilterChange : function (field, newValue) {
        var header      = this.header
        
        if (newValue) {
            var parts           = newValue.split(/\s*\|\s*/);
            var regexps         = []
            var lengths         = []
            
            for (var i = 0; i < parts.length; i++) {
                // ignore empty
                if (parts[ i ]) {
                    regexps.push(
                        Ext.Array.map(parts[ i ].split(/\s+/), function (token) { return new RegExp(Ext.String.escapeRegex(token), 'i') })
                    )
                    lengths.push(regexps[ regexps.length - 1 ].length)
                }
            }
            
            this.store.filterTreeBy({
                filter  : function (testFile) {
                    var title       = testFile.get('title')
                    
                    for (var p = 0; p < parts.length; p++) {
                        var groupMatch  = true
                        
                        // blazing fast "for" loop! :)
                        for (var i = 0; i < lengths[ p ]; i++)
                            if (!regexps[ p ][ i ].test(title)) {
                                groupMatch  = false
                                break
                            }
                            
                        if (groupMatch) return true
                    }
                        
                    return false
                },
                fullMathchingParents    : this.filterGroups
            })
            
            header.down('[type="down"]').disable()
            header.down('[type="up"]').disable()
        } else {
            this.store.clearTreeFilter()

            header.down('[type="down"]').enable()
            header.down('[type="up"]').enable()
        }
    },
    

    onExpandAll : function () {
        this.expandAll()
    }, 


    onCollapseAll : function () {
        this.collapseAll()
    },

    treeColumnRenderer : function (value, metaData, testFile, rowIndex, colIndex, store) {
        metaData.tdCls = 'tr-test-status '
    
        if (testFile.isLeaf()) {
    
            var test = testFile.get('test')
        
            if (test) {
            
                if (testFile.get('isFailed'))
                    metaData.tdCls += 'tr-test-status-thrown'
                
                else if (testFile.get('isRunning') && !test.isFinished())
                    metaData.tdCls += 'tr-test-status-running'
                else
                    if (test.isFinished()) {
                    
                        if (test.isPassed())
                            metaData.tdCls += 'tr-test-status-passed'
                        else 
                            metaData.tdCls += 'tr-test-status-failed'
                    } else
                        metaData.tdCls += 'tr-test-status-working'
                
            } else {
            
                if (testFile.get('isMissing'))
                    metaData.tdCls += 'tr-test-status-missing'
                else
                    if (testFile.get('isStarting'))
                        metaData.tdCls += 'tr-test-status-working'
                    else
                        metaData.tdCls += 'tr-test-status-empty'
            }
        } else {
            metaData.tdCls += 'tr-folder-' + testFile.get('folderStatus')
        }
        return value;
    },

    
    passedColumnRenderer : function (value, meta, record) {
        if (!record.isLeaf()) return ''
        
        if (record.data.todoPassCount > 0) {
            value += ' <span title="' + record.data.todoPassCount + ' todo assertion(s) passed" class="tr-test-todo tr-test-todo-pass">+ ' + record.data.todoPassCount + '</span>';
        }
        return value;
    },

    
    failedColumnRenderer : function (value, meta, record) {
        if (!record.isLeaf()) return ''
        
        if (record.data.todoFailCount > 0) {
            value += ' <span title="' + record.data.todoFailCount + ' todo assertion(s) failed" class="tr-test-todo tr-test-todo-fail">+ ' + record.data.todoFailCount + '</span>';
        }
        return value;
    }
})
