// Read-only provenance check for legacy Cheese Grating values.
// Never writes to movies or movie_traits; the checked trait rows are authoritative.
(function(root){
  'use strict';
  function audit(movie,selectedTraitIds,traitDefinitions){
    const definitions=new Map((traitDefinitions||[]).filter(t=>t&&t.id!=null).map(t=>[String(t.id),t]));
    const ids=[...new Set((selectedTraitIds||[]).filter(id=>id!=null).map(String))];
    let confirmedScore=0;
    const unknownTraitIds=[];
    for(const id of ids){
      const trait=definitions.get(id);
      if(!trait){unknownTraitIds.push(id);continue;}
      const points=Number(trait.points);
      if(Number.isFinite(points))confirmedScore+=points;
      else unknownTraitIds.push(id);
    }
    const raw=movie?.cheese_score;
    const parsed=raw===null||raw===undefined||raw===''?null:Number(raw);
    const storedScore=parsed!==null&&Number.isFinite(parsed)?parsed:null;
    const complete=unknownTraitIds.length===0;
    return {
      confirmedScore,storedScore,complete,unknownTraitIds,
      needsReview:!complete||(storedScore!==null&&storedScore!==confirmedScore)
    };
  }
  root.clCheeseGratingIntegrity=Object.freeze({audit});
})(typeof window!=='undefined'?window:globalThis);
