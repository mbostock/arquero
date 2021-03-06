const tape = require('tape');
const time = require('./time');
const { ints, sample, strings } = require('./data-gen');
const { fromArrow } = require('..');
const { Dictionary, Int32, Table, Utf8, Vector, predicate } = require('apache-arrow');

function run(N, nulls, msg) {
  const vectors = [
    Vector.from({
      type: new Dictionary(new Utf8(), new Int32()),
      values: sample(N, strings(100), nulls),
      highWaterMark: 1e12
    }),
    Vector.from({
      type: new Int32(),
      values: ints(N, -10000, 10000, nulls),
      highWaterMark: 1e12
    })
  ];
  const at = Table.new(vectors, ['k', 'v']);
  const dt = fromArrow(at);

  const arrowFilterDict = val => time(() => {
    const p = new predicate.Equals(
      new predicate.Col('k'),
      new predicate.Literal(val)
    );
    at.filter(p).count();
  });

  const arqueroFilterDict = val => time(() => {
    dt.filter(`d.k === '${val}'`).numRows();
  });

  const arrowFilterValue = val => time(() => {
    const p = new predicate.GTeq(
      new predicate.Col('v'),
      new predicate.Literal(val)
    );
    at.filter(p).count();
  });

  const arqueroFilterValue = val => time(() => {
    dt.filter(`d.v >= ${val}`).numRows();
  });

  tape(`arrow: ${msg}`, t => {
    const k = at.getColumn('k').get(50);
    console.table([ // eslint-disable-line
      {
        operation: 'init table',
        'arrow-js': time(() => Table.new(vectors, ['k', 'v'])),
        arquero:    time(() => fromArrow(at))
      },
      {
        operation: 'count dictionary',
        'arrow-js': time(() => at.countBy('k')),
        arquero:    time(() => dt.groupby('k').count())
      },
      {
        operation: 'filter dictionary',
        'arrow-js': arrowFilterDict(k),
        arquero:    arqueroFilterDict(k)
      },
      {
        operation: 'filter numbers 0',
        'arrow-js': arrowFilterValue(0),
        arquero:    arqueroFilterValue(0)
      },
      {
        operation: 'filter numbers 1',
        'arrow-js': arrowFilterValue(1),
        arquero:    arqueroFilterValue(1)
      }
    ]);
    t.end();
  });
}

run(5e6, 0, '5M values, 0% nulls');
run(5e6, 0.05, '5M values, 5% nulls');