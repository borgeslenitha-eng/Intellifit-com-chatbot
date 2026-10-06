"""Treino reproduzível, sem API. Execução: python ml/train.py (na pasta backend)."""
from pathlib import Path
import csv,json,re,unicodedata,hashlib
import numpy as np
import sklearn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score,f1_score,classification_report,confusion_matrix
ROOT=Path(__file__).resolve().parent

def tokenize(s):
 s=''.join(c for c in unicodedata.normalize('NFD',s.lower()) if not unicodedata.combining(c))
 return re.findall(r'[a-z]{2,}',s)
rows=list(csv.DictReader((ROOT/'dataset.csv').open(encoding='utf-8')))
assert len({r['text'].lower().strip() for r in rows})==len(rows), 'Exemplos duplicados'
idx=np.arange(len(rows)); labels=[r['intent'] for r in rows]
train_idx,rest_idx=train_test_split(idx,test_size=.30,random_state=42,stratify=labels)
val_idx,test_idx=train_test_split(rest_idx,test_size=.5,random_state=43,stratify=[labels[i] for i in rest_idx])
x=lambda indexes:[rows[i]['text'] for i in indexes];y=lambda indexes:[labels[i] for i in indexes]
vec=TfidfVectorizer(tokenizer=tokenize,token_pattern=None,lowercase=False,ngram_range=(1,2),sublinear_tf=True)
X=vec.fit_transform(x(train_idx)); clf=LogisticRegression(C=12,max_iter=2000,random_state=42);clf.fit(X,y(train_idx))
val_prob=clf.predict_proba(vec.transform(x(val_idx)));val_pred=clf.classes_[val_prob.argmax(axis=1)]
# Escolha de limiar SOMENTE pela validação: maior cobertura com >=90% de acerto entre aceitos.
candidates=[]
for threshold in np.arange(.30,.76,.05):
 accept=(val_prob.max(axis=1)>=threshold)&((np.sort(val_prob,axis=1)[:,-1]-np.sort(val_prob,axis=1)[:,-2])>=.08)
 if accept.sum() and np.mean(val_pred[accept]==np.array(y(val_idx))[accept])>=.90:candidates.append((float(accept.mean()),float(threshold)))
threshold=sorted(candidates,reverse=True)[0][1] if candidates else .55
prob=clf.predict_proba(vec.transform(x(test_idx)));pred=clf.classes_[prob.argmax(axis=1)];accepted=(prob.max(axis=1)>=threshold)&((np.sort(prob,axis=1)[:,-1]-np.sort(prob,axis=1)[:,-2])>=.08)
model={'version':1,'algorithm':'TF-IDF (word unigram/bigram, sublinear TF, L2) + multinomial logistic regression','threshold':round(threshold,2),'minimumMargin':.08,'classes':clf.classes_.tolist(),'vocabulary':{k:int(v) for k,v in vec.vocabulary_.items()},'idf':vec.idf_.tolist(),'coefficients':clf.coef_.tolist(),'intercepts':clf.intercept_.tolist()}
(ROOT/'model.json').write_text(json.dumps(model,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
report={'dataset_sha256':hashlib.sha256((ROOT/'dataset.csv').read_bytes()).hexdigest(),'sklearn_version':sklearn.__version__,'random_seeds':[42,43],'samples':len(rows),'split':{'train':len(train_idx),'validation':len(val_idx),'test':len(test_idx)},'threshold':model['threshold'],'accuracy':accuracy_score(y(test_idx),pred),'macro_f1':f1_score(y(test_idx),pred,average='macro'),'coverage_at_threshold':float(accepted.mean()),'accuracy_on_accepted':float(np.mean(pred[accepted]==np.array(y(test_idx))[accepted])) if accepted.sum() else None,'classification_report':classification_report(y(test_idx),pred,output_dict=True,zero_division=0),'classes':clf.classes_.tolist(),'confusion_matrix':confusion_matrix(y(test_idx),pred,labels=clf.classes_).tolist(),'limitations':['Base pequena e autoral; métricas internas não garantem desempenho em uso real.','Divisão estratificada por frases, não por autores ou grupos de paráfrases; linguagem semelhante pode elevar os resultados.','Pontuações do classificador não são probabilidades calibradas de acerto.','Modelo não aprende automaticamente com as conversas.']}
(ROOT/'evaluation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'splits.json').write_text(json.dumps({name:[rows[i] for i in ids] for name,ids in [('train',train_idx),('validation',val_idx),('test',test_idx)]},ensure_ascii=False,indent=2),encoding='utf-8')
fixtures=[{'text':rows[i]['text'],'intent':str(pred[k]),'scores':prob[k].tolist()} for k,i in enumerate(test_idx)]
(ROOT/'parity-fixtures.json').write_text(json.dumps(fixtures,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:report[k] for k in ['samples','split','threshold','accuracy','macro_f1','coverage_at_threshold','accuracy_on_accepted']},ensure_ascii=False,indent=2))
